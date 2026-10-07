/**
 * Network - WebSocket 实时对战网络同步管理器
 */
export class Network {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.roomCode = null;
    this.playerIndex = -1; // 0: 蓝方 (Host), 1: 红方 (Guest)
    this.isHost = false;
    this.ping = 25;

    // 回调列表
    this.onRoomCreated = null;
    this.onRoomJoined = null;
    this.onPeerJoined = null;
    this.onHeroSelect = null;
    this.onGameStart = null;
    this.onSyncTransform = null;
    this.onGameEvent = null;
    this.onPeerDisconnected = null;
    this.onError = null;

    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        const ind = document.getElementById('server-status-indicator');
        if (ind) ind.innerText = '🟢 服务器在线';
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        const ind = document.getElementById('server-status-indicator');
        if (ind) ind.innerText = '🔴 连接已断开';
        // 3秒后尝试重连
        setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }

        this.handleMessage(msg);
      };
    } catch (e) {
      console.error('Failed to create WebSocket', e);
    }
  }

  send(type, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  createRoom() {
    this.send('create_room');
  }

  joinRoom(code) {
    this.send('join_room', { code });
  }

  quickMatch() {
    this.send('quick_match');
  }

  selectHero(heroId) {
    this.send('select_hero', { heroId, ready: true });
  }

  sendTransform(transformData) {
    this.send('sync_transform', transformData);
  }

  sendGameEvent(eventData) {
    this.send('game_event', eventData);
  }

  handleMessage(msg) {
    const { type, data } = msg;

    switch (type) {
      case 'room_created':
        this.roomCode = data.code;
        this.playerIndex = data.playerIndex;
        this.isHost = data.isHost;
        if (this.onRoomCreated) this.onRoomCreated(data);
        break;

      case 'room_joined':
        this.roomCode = data.code;
        this.playerIndex = data.playerIndex;
        this.isHost = data.isHost;
        if (this.onRoomJoined) this.onRoomJoined(data);
        break;

      case 'peer_joined':
        if (this.onPeerJoined) this.onPeerJoined(data);
        break;

      case 'enter_hero_select':
        if (this.onHeroSelect) this.onHeroSelect(data);
        break;

      case 'game_start':
        if (this.onGameStart) this.onGameStart(data);
        break;

      case 'sync_transform':
        if (this.onSyncTransform) this.onSyncTransform(data);
        break;

      case 'game_event':
        if (this.onGameEvent) this.onGameEvent(data);
        break;

      case 'peer_disconnected':
        if (this.onPeerDisconnected) this.onPeerDisconnected(data);
        break;

      case 'error':
        if (this.onError) this.onError(data);
        break;

      default:
        break;
    }
  }
}
