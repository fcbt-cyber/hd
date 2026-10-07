const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const qrcode = require('qrcode-terminal');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 5001;

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[HTTP ${new Date().toLocaleTimeString()}] ${req.ip || req.socket.remoteAddress} -> ${req.method} ${req.url}`);
  next();
});

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Simple healthcheck API
app.get('/api/info', (req, res) => {
  res.json({
    name: 'WZRY-3D Mobile MOBA',
    status: 'online',
    rooms: Object.keys(rooms).length
  });
});

// Rooms state
// roomCode -> { id, players: [ws1, ws2], gameState: {...}, minionTimer: ... }
const rooms = {};

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function generateRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms[code]);
  return code;
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.roomCode = null;
  ws.playerIndex = -1; // 0: Blue, 1: Red
  ws.heroId = null;
  ws.isReady = false;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    const { type, data } = msg;

    switch (type) {
      case 'create_room': {
        const code = generateRoomCode();
        rooms[code] = {
          code,
          players: [ws],
          state: 'waiting', // waiting, picking, playing, ended
          created: Date.now()
        };
        ws.roomCode = code;
        ws.playerIndex = 0; // Blue (Host)
        ws.send(JSON.stringify({
          type: 'room_created',
          data: { code, playerIndex: 0, isHost: true }
        }));
        break;
      }

      case 'join_room': {
        const code = (data.code || '').trim();
        const room = rooms[code];
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', data: { message: '房间不存在' } }));
          return;
        }
        if (room.players.length >= 2) {
          ws.send(JSON.stringify({ type: 'error', data: { message: '房间已满员' } }));
          return;
        }
        room.players.push(ws);
        ws.roomCode = code;
        ws.playerIndex = 1; // Red (Guest)

        ws.send(JSON.stringify({
          type: 'room_joined',
          data: { code, playerIndex: 1, isHost: false }
        }));

        // Notify host
        room.players[0].send(JSON.stringify({
          type: 'peer_joined',
          data: { playerIndex: 1 }
        }));

        room.state = 'picking';
        broadcastToRoom(room, {
          type: 'enter_hero_select',
          data: { message: '双方已就位，进入英雄选择！' }
        });
        break;
      }

      case 'quick_match': {
        // Find existing waiting room or create new
        let targetRoom = null;
        for (const code in rooms) {
          if (rooms[code].players.length === 1 && rooms[code].state === 'waiting') {
            targetRoom = rooms[code];
            break;
          }
        }
        if (targetRoom) {
          targetRoom.players.push(ws);
          ws.roomCode = targetRoom.code;
          ws.playerIndex = 1;
          ws.send(JSON.stringify({
            type: 'room_joined',
            data: { code: targetRoom.code, playerIndex: 1, isHost: false }
          }));
          targetRoom.players[0].send(JSON.stringify({
            type: 'peer_joined',
            data: { playerIndex: 1 }
          }));
          targetRoom.state = 'picking';
          broadcastToRoom(targetRoom, {
            type: 'enter_hero_select',
            data: { message: '匹配成功，进入英雄选择！' }
          });
        } else {
          const code = generateRoomCode();
          rooms[code] = {
            code,
            players: [ws],
            state: 'waiting',
            created: Date.now()
          };
          ws.roomCode = code;
          ws.playerIndex = 0;
          ws.send(JSON.stringify({
            type: 'room_created',
            data: { code, playerIndex: 0, isHost: true }
          }));
        }
        break;
      }

      case 'select_hero': {
        const room = rooms[ws.roomCode];
        if (!room) return;
        ws.heroId = data.heroId;
        ws.isReady = data.ready !== false;

        // Broadcast hero update to opponent
        broadcastToRoom(room, {
          type: 'hero_selected',
          data: {
            playerIndex: ws.playerIndex,
            heroId: ws.heroId,
            isReady: ws.isReady
          }
        });

        // Check if both ready
        if (room.players.length === 2 && room.players[0].isReady && room.players[1].isReady) {
          room.state = 'playing';
          broadcastToRoom(room, {
            type: 'game_start',
            data: {
              player0Hero: room.players[0].heroId || 'arthur',
              player1Hero: room.players[1].heroId || 'daji',
              startTime: Date.now()
            }
          });
        }
        break;
      }

      case 'game_event': {
        // Broadcast game event (skill cast, damage dealt, minion spawn, ping, death) to opponent
        const room = rooms[ws.roomCode];
        if (!room) return;
        const opponent = room.players.find(p => p !== ws);
        if (opponent && opponent.readyState === ws.OPEN) {
          opponent.send(JSON.stringify({
            type: 'game_event',
            data: { ...data, sender: ws.playerIndex }
          }));
        }
        break;
      }

      case 'sync_transform': {
        // High frequency position & rotation sync
        const room = rooms[ws.roomCode];
        if (!room) return;
        const opponent = room.players.find(p => p !== ws);
        if (opponent && opponent.readyState === ws.OPEN) {
          opponent.send(JSON.stringify({
            type: 'sync_transform',
            data: { ...data, sender: ws.playerIndex }
          }));
        }
        break;
      }

      case 'chat_message': {
        const room = rooms[ws.roomCode];
        if (!room) return;
        broadcastToRoom(room, {
          type: 'chat_message',
          data: { sender: ws.playerIndex, text: data.text }
        });
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (ws.roomCode && rooms[ws.roomCode]) {
      const room = rooms[ws.roomCode];
      room.players = room.players.filter(p => p !== ws);
      if (room.players.length === 0) {
        delete rooms[ws.roomCode];
      } else {
        broadcastToRoom(room, {
          type: 'peer_disconnected',
          data: { message: '对手已退出对战' }
        });
        room.state = 'waiting';
      }
    }
  });
});

function broadcastToRoom(room, payload) {
  const json = JSON.stringify(payload);
  room.players.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(json);
    }
  });
}

// Heartbeat ping
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

let currentPort = parseInt(process.env.PORT || 5001, 10);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️  注意: 端口 ${currentPort} 已被占用！`);
    if (currentPort === 5000) {
      console.error('💡 原因：macOS 系统默认将 5000 端口分配给【隔空播放接收目标 (AirPlay Receiver)】。');
      console.error('👉 若想使用 5000 端口：打开 Mac「系统设置」->「通用」->「隔空投送与接力」-> 关闭【隔空播放接收目标】即可。');
      console.error('🔄 正在自动切换至 5001 端口就绪，保证对局随时可用...\n');
      currentPort = 5001;
      setTimeout(() => startServer(5001), 600);
    }
  } else {
    console.error('Server error:', err);
  }
});

wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // handled by server error
    return;
  }
  console.error('WSS error:', err);
});

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    const localIP = getLocalIP();
    const localUrl = `http://localhost:${port}`;
    const networkUrl = `http://${localIP}:${port}`;

    console.log('====================================================');
    console.log('⚔️  王者荣耀 3D 移动端 1v1 对战游戏服务已就绪！ ⚔️');
    console.log('====================================================');
    console.log(`🖥️  本机访问:   ${localUrl}`);
    console.log(`📱 手机扫码访问: ${networkUrl}`);
    console.log('----------------------------------------------------');
    console.log('📱 手机同一局域网 Wi-Fi 下扫描下方二维码直接进入游戏:');
    console.log('----------------------------------------------------');
    try {
      qrcode.generate(networkUrl, { small: true });
    } catch (err) {
      console.log('（二维码生成跳过）');
    }
    console.log('====================================================\n');
  });
}

startServer(currentPort);
