import * as THREE from '../libs/three.module.js';
import { SoundManager } from './audio/SoundManager.js';
import { TouchControls } from './controls/TouchControls.js';
import { Arthur } from './entities/Arthur.js';
import { Daji } from './entities/Daji.js';
import { Houyi } from './entities/Houyi.js';
import { Tower } from './entities/Tower.js';
import { Crystal } from './entities/Crystal.js';
import { Minion } from './entities/Minion.js';
import { Map } from './world/Map.js';
import { Projectiles } from './world/Projectiles.js';
import { HUD } from './ui/HUD.js';
import { MiniMap } from './ui/MiniMap.js';
import { FloatingText } from './ui/FloatingText.js';
import { BotAI } from './ai/BotAI.js';
import { Network } from './network/Network.js';

class Game {
  constructor() {
    this.sound = new SoundManager();
    this.network = new Network();
    this.hud = new HUD(this.sound);
    this.miniMap = new MiniMap();

    // 运行状态
    this.state = 'LOBBY'; // LOBBY, ROOM, HERO_SELECT, PLAYING, SETTLED
    this.isSinglePlayer = true;
    this.selectedHeroType = 'arthur';
    this.playerTeam = 0; // 0: 蓝方, 1: 红方

    // 对局统计
    this.matchTime = 0;
    this.scoreBlue = 0;
    this.scoreRed = 0;
    this.firstBloodTaken = false;
    this.towersDestroyed = 0;

    // 出兵计时器 (首波 5 秒，之后每 25 秒一波)
    this.waveTimer = 5;

    // 初始化 Three.js 核心场景
    this.initThree();

    // 地图与弹道
    this.map = new Map(this.scene);
    this.projectiles = new Projectiles(this.scene, this);
    this.floatingText = new FloatingText(this.camera);

    // 战斗实体容器
    this.playerHero = null;
    this.opponentHero = null;
    this.towers = [];
    this.crystals = [];
    this.minions = [];
    this.botAI = null;

    // 触控输入
    this.controls = new TouchControls({
      onMove: (vec) => this.handleMove(vec),
      onAttack: () => this.handleAttack(),
      onSkillStartAim: (id) => this.handleSkillStartAim(id),
      onSkillUpdateAim: (id, vec, dist, cancel) => this.handleSkillUpdateAim(id, vec, dist, cancel),
      onSkillCast: (id, vec, isSmart) => this.handleSkillCast(id, vec, isSmart),
      onSkillCancel: (id) => this.handleSkillCancel(id),
      onRecall: () => this.handleRecall(),
      onHeal: () => this.handleHeal(),
      onSpell: () => this.handleSpell(),
      onUpgradeSkill: (id) => this.handleUpgradeSkill(id)
    });

    // 界面与网络交互绑定
    this.initUIEvents();
    this.initNetworkEvents();

    // 启动主渲染循环
    this.lastFrameTime = performance.now();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    const container = document.getElementById('canvas-container');

    // 1. 场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.007);

    // 2. 摄像机 (经典的 45 度微斜俯视 MOBA 视角)
    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 18, 16);

    // 3. 渲染器 (兼容移动端 GPU 环境)
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'default'
      });
    } catch (e) {
      this.renderer = new THREE.WebGLRenderer({ antialias: false });
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 4. 灯光系统 (全图均匀覆盖光影，无阴影裁剪黑边)
    const hemiLight = new THREE.HemisphereLight(0xc7d2fe, 0x1e293b, 0.95);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    dirLight.position.set(0, 50, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 180;
    const d = 80; // 覆盖 X 轴 -80 至 +80
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = 35;
    dirLight.shadow.camera.bottom = -35;
    this.scene.add(dirLight);

    // 视口尺寸与移动端横竖屏无缝适配
    this.lastViewportW = window.innerWidth || document.documentElement.clientWidth;
    this.lastViewportH = window.innerHeight || document.documentElement.clientHeight;

    const triggerResize = () => {
      this.updateViewportSize();
      setTimeout(() => this.updateViewportSize(), 60);
      setTimeout(() => this.updateViewportSize(), 150);
      setTimeout(() => this.updateViewportSize(), 300);
      setTimeout(() => this.updateViewportSize(), 600);
    };

    window.addEventListener('resize', triggerResize);
    window.addEventListener('orientationchange', triggerResize);
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', triggerResize);
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', triggerResize);
    }
  }

  updateViewportSize(forceW = null, forceH = null) {
    if (!this.renderer || !this.camera) return;
    const w = forceW || window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const h = forceH || window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    if (w <= 0 || h <= 0) return;

    this.lastViewportW = w;
    this.lastViewportH = h;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, true);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  // 移动端专用防抖双重触控绑定 (同时适配 Touch 与 Mouse Click)
  bindTap(el, handler) {
    if (!el) return;
    let handled = false;
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      handled = true;
      handler(e);
      setTimeout(() => { handled = false; }, 320);
    }, { passive: false });
    el.addEventListener('click', (e) => {
      if (!handled) handler(e);
    });
  }

  initUIEvents() {
    // 0. 横屏提示遮罩事件 (一键进入，绝不阻断用户)
    const promptMask = document.getElementById('landscape-prompt');
    const btnEnter = document.getElementById('btn-enter-game');
    const btnRotate = document.getElementById('btn-force-rotate');

    if (btnEnter) {
      this.bindTap(btnEnter, () => {
        if (promptMask) promptMask.classList.add('dismissed');
        this.sound.ensureContext();
      });
    }

    if (btnRotate) {
      this.bindTap(btnRotate, () => {
        document.body.classList.toggle('forced-rotate');
        if (promptMask) promptMask.classList.add('dismissed');
        this.sound.ensureContext();
        setTimeout(() => {
          this.camera.aspect = window.innerWidth / window.innerHeight;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(window.innerWidth, window.innerHeight);
        }, 150);
      });
    }

    if (promptMask) {
      this.bindTap(promptMask, (e) => {
        if (e.target === promptMask) {
          promptMask.classList.add('dismissed');
        }
      });
    }

    // 静音切换
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
      this.bindTap(btnMute, () => {
        const isMuted = this.sound.toggleMute();
        btnMute.innerText = isMuted ? '🔇' : '🔊';
      });
    }

    // 单人 AI 训练入口
    const btnSoloAI = document.getElementById('btn-solo-ai');
    if (btnSoloAI) {
      this.bindTap(btnSoloAI, () => {
        this.sound.ensureContext();
        this.isSinglePlayer = true;
        this.playerTeam = 0;
        this.switchScreen('hero-select-screen');
      });
    }

    // 快速匹配
    const btnQuickMatch = document.getElementById('btn-quick-match');
    if (btnQuickMatch) {
      this.bindTap(btnQuickMatch, () => {
        this.sound.ensureContext();
        this.isSinglePlayer = false;
        this.network.quickMatch();
      });
    }

    // 创建房间
    const btnCreateRoom = document.getElementById('btn-create-room');
    if (btnCreateRoom) {
      this.bindTap(btnCreateRoom, () => {
        this.sound.ensureContext();
        this.isSinglePlayer = false;
        this.network.createRoom();
      });
    }

    // 加入房间
    const btnJoinRoom = document.getElementById('btn-join-room');
    const roomInput = document.getElementById('room-code-input');
    if (btnJoinRoom && roomInput) {
      this.bindTap(btnJoinRoom, () => {
        const code = roomInput.value.trim();
        if (code.length === 4) {
          this.sound.ensureContext();
          this.isSinglePlayer = false;
          this.network.joinRoom(code);
        } else {
          alert('请输入正确的 4 位房间码');
        }
      });
    }

    // 退出房间
    const btnLeaveRoom = document.getElementById('btn-leave-room');
    if (btnLeaveRoom) {
      this.bindTap(btnLeaveRoom, () => {
        this.switchScreen('lobby-screen');
      });
    }

    // 英雄选择卡片点击
    const heroCards = document.querySelectorAll('.hero-card');
    heroCards.forEach(card => {
      this.bindTap(card, () => {
        heroCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedHeroType = card.dataset.hero;
        this.updateHeroDetailPreview(this.selectedHeroType);
      });
    });
    this.updateHeroDetailPreview('arthur');

    // 确认出战按钮
    const btnConfirmHero = document.getElementById('btn-confirm-hero');
    if (btnConfirmHero) {
      this.bindTap(btnConfirmHero, () => {
        if (this.isSinglePlayer) {
          // 单人模式：电脑随机挑选另一位英雄
          const allHeroes = ['arthur', 'daji', 'houyi'];
          const opponents = allHeroes.filter(h => h !== this.selectedHeroType);
          const botHeroType = opponents[Math.floor(Math.random() * opponents.length)];
          this.startBattle(this.selectedHeroType, botHeroType);
        } else {
          // 联机模式：通知服务器英雄选择就绪
          this.network.selectHero(this.selectedHeroType);
          btnConfirmHero.innerText = '等待对手确认...';
        }
      });
    }

    // 结算返回大厅
    const btnSettle = document.getElementById('btn-settle-lobby');
    if (btnSettle) {
      this.bindTap(btnSettle, () => {
        document.getElementById('settlement-modal').classList.remove('active');
        this.resetGame();
        this.switchScreen('lobby-screen');
      });
    }

    // 投降/退出对局
    const btnSurrender = document.getElementById('btn-surrender');
    if (btnSurrender) {
      this.bindTap(btnSurrender, () => {
        if (confirm('确认放弃本场对决返回大厅吗？')) {
          this.resetGame();
          this.switchScreen('lobby-screen');
        }
      });
    }
  }

  updateHeroDetailPreview(heroType) {
    const titleEl = document.getElementById('hero-detail-name');
    const skillsEl = document.getElementById('hero-detail-skills');
    if (heroType === 'arthur') {
      titleEl.innerText = '亚瑟 (战士 / 坦克)';
      skillsEl.innerHTML = `
        <b>被动·圣光守护</b>：常态每2秒回复2%最大生命。<br>
        <b>1技能·誓约之盾</b>：提升35%移速，强化下次攻击为跳斩跃击并造成沉默。<br>
        <b>2技能·回旋打击</b>：召唤旋转圣盾围绕周身，造成持续多段范围伤害。<br>
        <b>3技能·圣剑裁决</b>：跃起狂暴砸向目标区域，造成击飞控制与高额斩杀伤害。
      `;
    } else if (heroType === 'daji') {
      titleEl.innerText = '妲己 (法师 / 爆发控制)';
      skillsEl.innerHTML = `
        <b>被动·失心</b>：技能命中减少目标法术抗性。<br>
        <b>1技能·灵魂冲击</b>：向前方发射直线法术冲击波，穿透路径敌人。<br>
        <b>2技能·偶像魅力</b>：射出爱心追踪法球，造成伤害并眩晕目标 1.5 秒。<br>
        <b>3技能·女王崇拜</b>：瞬间释放 5 团狐火连续轰击附近敌人，极高爆发。
      `;
    } else if (heroType === 'houyi') {
      titleEl.innerText = '后羿 (射手 / 远程持续)';
      skillsEl.innerHTML = `
        <b>被动·迟缓箭雨</b>：连续普攻叠加攻速，叠满3层普攻分裂为3支箭矢。<br>
        <b>1技能·炙热之风</b>：强化普攻，单次普攻伤害大幅提升。<br>
        <b>2技能·落日余晖</b>：召唤空中日光轰炸指定区域，造成减速与范围伤害。<br>
        <b>3技能·灼日之矢</b>：射出全图飞行的火焰巨鸟神箭，命中英雄造成极长眩晕。
      `;
    }
  }

  initNetworkEvents() {
    this.network.onRoomCreated = (data) => {
      document.getElementById('display-room-code').innerText = data.code;
      this.switchScreen('room-screen');
    };

    this.network.onRoomJoined = (data) => {
      document.getElementById('display-room-code').innerText = data.code;
      document.getElementById('opponent-status').innerText = '已加入';
      document.getElementById('opponent-status').classList.remove('waiting');
      this.switchScreen('room-screen');
    };

    this.network.onHeroSelect = () => {
      this.switchScreen('hero-select-screen');
    };

    this.network.onGameStart = (data) => {
      const pHero = this.network.playerIndex === 0 ? data.player0Hero : data.player1Hero;
      const opHero = this.network.playerIndex === 0 ? data.player1Hero : data.player0Hero;
      this.playerTeam = this.network.playerIndex;
      this.startBattle(pHero, opHero);
    };

    this.network.onSyncTransform = (data) => {
      if (!this.opponentHero) return;

      // 1. 同步坐标与朝向
      if (typeof data.x === 'number') {
        this.opponentHero.mesh.position.set(data.x, data.y || 0, data.z);
        this.opponentHero.mesh.rotation.y = data.rotY || 0;
      }

      // 2. 实时同步权威血量与最大血量
      if (typeof data.hp === 'number') {
        this.opponentHero.hp = data.hp;
      }
      if (typeof data.maxHp === 'number') {
        this.opponentHero.maxHp = data.maxHp;
      }
      if (typeof data.level === 'number') {
        this.opponentHero.level = data.level;
      }
      this.opponentHero.updateHpSprite();

      // 3. 权威生死状态同步
      if (data.isDead) {
        if (!this.opponentHero.isDead) {
          this.opponentHero.hp = 0;
          this.opponentHero.updateHpSprite();
          this.opponentHero.die();
          this.checkHeroKillEvents();
        }
        if (typeof data.respawnTimer === 'number') {
          this.opponentHero.respawnTimer = data.respawnTimer;
        }
      } else {
        if (this.opponentHero.isDead) {
          this.opponentHero.respawn();
          this.opponentHero.hp = data.hp || this.opponentHero.maxHp;
          this.opponentHero.updateHpSprite();
        }
      }

      // 4. 同步击杀数与红蓝比分 (确保两端数字百分之百完全一致)
      if (typeof data.kills === 'number') {
        this.opponentHero.kills = data.kills;
      }
      if (typeof data.deaths === 'number') {
        this.opponentHero.deaths = data.deaths;
      }
      if (this.playerHero) {
        if (this.playerTeam === 0) {
          this.scoreBlue = this.playerHero.kills;
          this.scoreRed = this.opponentHero.kills;
        } else {
          this.scoreBlue = this.opponentHero.kills;
          this.scoreRed = this.playerHero.kills;
        }
      }
    };

    this.network.onGameEvent = (data) => {
      this.handleRemoteGameEvent(data);
    };

    this.network.onPeerDisconnected = () => {
      this.hud.showBanner('对手离开', '对手已退出对战');
    };

    this.network.onError = (err) => {
      alert(err.message || '网络连接发生异常');
    };
  }

  // 处理联机对手发送的游戏操作事件 (普攻、技能释放、受到伤害等)
  handleRemoteGameEvent(data) {
    if (!this.opponentHero) return;
    const opHero = this.opponentHero;
    const myHero = this.playerHero;
    const heroPos = opHero.mesh.position;

    // 1. 核心：我方英雄受到权威伤害结算
    if (data.action === 'hero_take_damage') {
      if (myHero && !myHero.isDead) {
        const actualDmg = myHero.takeDamage(data.amount, data.type || 'physical', opHero);
        const textType = data.type === 'magic' ? 'magic' : (data.type === 'true' ? 'crit' : 'phys');
        this.floatingText.show(myHero.mesh.position, `-${actualDmg}`, textType);
        if (data.stun) myHero.applyStun(data.stun);
        if (data.silence) myHero.applySilence(data.silence);
        if (myHero.isDead) {
          this.checkHeroKillEvents();
        }
      }
      return;
    }

    // 2. 对手英雄死亡通告
    if (data.action === 'hero_died') {
      if (opHero && !opHero.isDead) {
        opHero.hp = 0;
        opHero.updateHpSprite();
        opHero.die();
        this.checkHeroKillEvents();
      }
      return;
    }

    // 3. 对手英雄复活通告
    if (data.action === 'hero_respawned') {
      if (opHero && opHero.isDead) {
        opHero.respawn();
        opHero.hp = opHero.maxHp;
        opHero.updateHpSprite();
      }
      return;
    }

    // 4. 水晶爆裂游戏结算
    if (data.action === 'crystal_destroyed') {
      if (this.state !== 'SETTLED') {
        this.handleCrystalDestroyed(data.loserTeam);
      }
      return;
    }

    if (opHero.isDead) return;

    // 5. 普攻事件处理
    if (data.action === 'basic_attack') {
      let target = null;
      if (data.targetType === 'hero') {
        target = myHero;
      } else if (data.targetType === 'tower') {
        target = this.towers.find(t => t.team === data.targetIndex);
      } else if (data.targetType === 'crystal') {
        target = this.crystals.find(c => c.team === data.targetIndex);
      } else if (data.targetType === 'minion') {
        // 关键防护：对手攻击小兵时，仅锁定敌方小兵，绝不可降级回退攻击我方英雄！
        target = this.minions.find(m => m.team !== opHero.team && !m.isDead) || null;
      }
      if (!target || target.isDead) return;

      if (opHero.heroType === 'arthur') {
        this.sound.playAttackSlash();
        // 如果目标是小兵或建筑，由被攻击端扣除生命值；若目标是英雄，伤害已由 hero_take_damage 结算，杜绝双重扣血
        if (target !== myHero) {
          let dmg = opHero.attack;
          if (opHero.s1Empowered) {
            dmg = Math.round(dmg * 2.2);
            opHero.s1Empowered = false;
          }
          const actualDmg = target.takeDamage(dmg, 'physical', opHero);
          this.floatingText.show(target.mesh.position, `-${actualDmg}`, 'phys');
        }
      } else if (opHero.heroType === 'daji') {
        this.sound.playMagicCast();
        this.projectiles.spawnMagicBullet(heroPos, target, opHero.attack, opHero);
      } else if (opHero.heroType === 'houyi') {
        this.sound.playBowShoot();
        opHero.onBasicAttackSuccess();
        let dmg = opHero.attack;
        if (opHero.s1ActiveTimer > 0) dmg = Math.round(dmg * 1.45);
        this.projectiles.spawnArrow(heroPos, target, dmg, opHero);
      }
    } else if (data.action === 'skill_cast') {
      const skillId = data.skillId;
      const castDir = data.castDir || { x: opHero.team === 0 ? 1 : -1, z: 0 };

      if (opHero.heroType === 'arthur') {
        if (skillId === 1) {
          if (opHero.castSkill1()) this.sound.playArthurSkill1();
        } else if (skillId === 2) {
          if (opHero.castSkill2()) this.sound.playArthurSkill2();
        } else if (skillId === 3) {
          const targetPos = myHero ? myHero.mesh.position : { x: heroPos.x + castDir.x * 3, z: heroPos.z + castDir.z * 3 };
          if (opHero.castSkill3(targetPos)) {
            this.sound.playArthurSkill3();
            this.projectiles.spawnArthurSlamShockwave(targetPos);
            // 亚瑟大招伤害已由 hero_take_damage 事件权威结算，此处仅播放音效与地面冲击波特效
          }
        }
      } else if (opHero.heroType === 'daji') {
        if (skillId === 1) {
          if (opHero.castSkill1()) {
            this.sound.playMagicCast();
            const enemies = this.getEnemyUnits(opHero.team);
            this.projectiles.spawnDajiS1Wave(heroPos, castDir, 420, opHero, enemies);
          }
        } else if (skillId === 2) {
          if (opHero.castSkill2()) {
            this.sound.playDajiCharm();
            if (myHero && !myHero.isDead) {
              this.projectiles.spawnDajiCharm(heroPos, myHero, 280, opHero);
              this.floatingText.show(myHero.mesh.position, '魅惑眩晕!', 'magic');
            }
          }
        } else if (skillId === 3) {
          if (opHero.castSkill3()) {
            this.sound.playMagicCast();
            if (myHero && !myHero.isDead) {
              this.projectiles.spawnDajiFoxFire(heroPos, myHero, 220, opHero);
            }
          }
        }
      } else if (opHero.heroType === 'houyi') {
        if (skillId === 1) {
          opHero.castSkill1();
        } else if (skillId === 2) {
          if (opHero.castSkill2()) {
            const strikePos = { x: heroPos.x + castDir.x * 3.5, z: heroPos.z + castDir.z * 3.5 };
            const enemies = this.getEnemyUnits(opHero.team);
            this.projectiles.spawnHouyiSunStrike(strikePos, 350, opHero, enemies);
          }
        } else if (skillId === 3) {
          if (opHero.castSkill3()) {
            this.sound.playHouyiUlt();
            const enemies = this.getEnemyUnits(opHero.team);
            this.projectiles.spawnHouyiUlt(heroPos, castDir, 580, opHero, enemies, (hitHero) => {
              this.floatingText.show(hitHero.mesh.position, '眩晕大中!', 'crit');
            });
          }
        }
      }
    }
  }

  switchScreen(screenId) {
    document.querySelectorAll('.ui-screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
    this.state = screenId.toUpperCase().replace('-SCREEN', '');
  }

  // 创建具体英雄实体
  createHeroInstance(type, team) {
    const startX = team === 0 ? -45 : 45;
    const opts = { scene: this.scene, team, x: startX, y: 0, z: 0 };
    if (type === 'arthur') return new Arthur(opts);
    if (type === 'daji') return new Daji(opts);
    if (type === 'houyi') return new Houyi(opts);
    return new Arthur(opts);
  }

  // 正式开启对局
  startBattle(playerHeroType, opponentHeroType) {
    this.resetGame();

    // 1. 初始化双方英雄
    this.playerHero = this.createHeroInstance(playerHeroType, this.playerTeam);
    const opponentTeam = this.playerTeam === 0 ? 1 : 0;
    this.opponentHero = this.createHeroInstance(opponentHeroType, opponentTeam);
    if (!this.isSinglePlayer) {
      this.opponentHero.isRemotePeer = true;
    }

    // 2. 初始化防御塔 (蓝方外塔 X = -20, 红方外塔 X = 20)
    const blueTower = new Tower({ scene: this.scene, team: 0, x: -20, y: 0, z: 0 });
    const redTower = new Tower({ scene: this.scene, team: 1, x: 20, y: 0, z: 0 });
    this.towers = [blueTower, redTower];

    // 3. 初始化双方基地水晶 (蓝方 X = -45, 红方 X = 45)
    const blueCrystal = new Crystal({
      scene: this.scene,
      team: 0,
      x: -45,
      y: 0,
      z: 0,
      onDestroyed: (loserTeam) => this.handleCrystalDestroyed(loserTeam)
    });
    const redCrystal = new Crystal({
      scene: this.scene,
      team: 1,
      x: 45,
      y: 0,
      z: 0,
      onDestroyed: (loserTeam) => this.handleCrystalDestroyed(loserTeam)
    });
    this.crystals = [blueCrystal, redCrystal];

    // 4. 单人模式智能 Bot AI
    if (this.isSinglePlayer) {
      const friendlyTower = opponentTeam === 0 ? blueTower : redTower;
      const enemyTower = opponentTeam === 0 ? redTower : blueTower;
      const friendlyCrystal = opponentTeam === 0 ? blueCrystal : redCrystal;
      this.botAI = new BotAI(this.opponentHero, this.playerHero, friendlyTower, enemyTower, friendlyCrystal);
    }

    // 5. HUD 绑定
    this.hud.bindHero(this.playerHero, (item) => {
      return this.playerHero.buyItem(item);
    });

    // 立即将摄像机精准吸附到玩家英雄出生点，并刷新视口尺寸杜绝黑边
    if (this.playerHero) {
      this.updateViewportSize();
      this.camera.position.set(this.playerHero.mesh.position.x, 18, this.playerHero.mesh.position.z + 14);
      this.camera.lookAt(this.playerHero.mesh.position.x, 1.2, this.playerHero.mesh.position.z);
    }

    this.switchScreen('battle-hud');
    this.state = 'PLAYING';
    this.sound.playLevelUp();
    this.hud.showBanner('全军出击', 'Enemy has deployed');
  }

  // 周期性出兵系统
  spawnMinionWave() {
    // 双方各刷新 1 个近战兵 + 1 个远程兵
    const spawnPoints = [
      { team: 0, x: -44 },
      { team: 1, x: 44 }
    ];

    spawnPoints.forEach(sp => {
      // 近战兵
      const melee = new Minion({
        scene: this.scene,
        team: sp.team,
        minionType: 'melee',
        x: sp.x,
        y: 0,
        z: (Math.random() - 0.5) * 2.0
      });
      // 远程兵
      const ranged = new Minion({
        scene: this.scene,
        team: sp.team,
        minionType: 'ranged',
        x: sp.x + (sp.team === 0 ? -2 : 2),
        y: 0,
        z: (Math.random() - 0.5) * 2.0
      });
      this.minions.push(melee, ranged);
    });
  }

  // === 触控操作处理 ===
  handleMove(vec) {
    if (!this.playerHero || this.playerHero.isDead || this.playerHero.isStunned()) return;
    this.playerHero.moveVector = vec;
  }

  handleAttack() {
    if (!this.playerHero || this.playerHero.isDead || this.playerHero.isStunned()) return;

    // 索敌：优先攻击射程内最近的目标 (敌方英雄 > 敌方小兵 > 防御塔/水晶)
    const enemies = this.getEnemyUnits(this.playerHero.team);
    let target = null;
    let minDist = this.playerHero.attackRange;

    // 优先搜寻英雄
    const enemyHero = this.opponentHero;
    if (enemyHero && !enemyHero.isDead) {
      const d = this.playerHero.mesh.position.distanceTo(enemyHero.mesh.position);
      if (d <= minDist) {
        target = enemyHero;
      }
    }

    // 若无英雄，搜索射程内小兵或建筑
    if (!target) {
      enemies.forEach(e => {
        if (!e.isDead) {
          const d = this.playerHero.mesh.position.distanceTo(e.mesh.position);
          if (d <= minDist) {
            minDist = d;
            target = e;
          }
        }
      });
    }

    if (!target) return; // 射程内无敌对目标

    // 普攻冷却
    const now = Date.now() / 1000;
    if (now - this.playerHero.lastAttackTime < this.playerHero.attackCooldown) return;
    this.playerHero.lastAttackTime = now;

    // 面向目标
    const angle = Math.atan2(
      target.mesh.position.x - this.playerHero.mesh.position.x,
      target.mesh.position.z - this.playerHero.mesh.position.z
    );
    this.playerHero.mesh.rotation.y = angle;

    // 执行普攻
    if (this.playerHero.heroType === 'arthur') {
      this.sound.playAttackSlash();
      let dmg = this.playerHero.attack;
      let silence = 0;
      if (this.playerHero.s1Empowered) {
        dmg = Math.round(dmg * 2.2);
        this.playerHero.s1Empowered = false;
        silence = 1000;
        target.applySilence(1000);
        this.floatingText.show(target.mesh.position, '沉默!', 'crit');
      }
      if (!this.isSinglePlayer && target === this.opponentHero) {
        this.opponentHero.takeOptimisticDamage(dmg);
        this.floatingText.show(target.mesh.position, `-${dmg}`, 'phys');
        this.network.sendGameEvent({
          action: 'hero_take_damage',
          amount: dmg,
          type: 'physical',
          silence
        });
      } else {
        const actualDmg = target.takeDamage(dmg, 'physical', this.playerHero);
        this.floatingText.show(target.mesh.position, `-${actualDmg}`, 'phys');
      }
    } else if (this.playerHero.heroType === 'daji') {
      this.sound.playMagicCast();
      this.projectiles.spawnMagicBullet(
        this.playerHero.mesh.position,
        target,
        this.playerHero.attack,
        this.playerHero
      );
    } else if (this.playerHero.heroType === 'houyi') {
      this.sound.playBowShoot();
      this.playerHero.onBasicAttackSuccess();
      let dmg = this.playerHero.attack;
      if (this.playerHero.s1ActiveTimer > 0) dmg = Math.round(dmg * 1.45);
      this.projectiles.spawnArrow(
        this.playerHero.mesh.position,
        target,
        dmg,
        this.playerHero
      );
      // 若被动 3 层，触发多重分裂箭射向周围副目标
      if (this.playerHero.passiveStacks >= 3) {
        enemies.slice(0, 2).forEach(extraTarget => {
          if (extraTarget !== target && !extraTarget.isDead) {
            this.projectiles.spawnArrow(
              this.playerHero.mesh.position,
              extraTarget,
              Math.round(dmg * 0.6),
              this.playerHero
            );
          }
        });
      }
    }

    if (!this.isSinglePlayer) {
      let targetType = 'minion';
      let targetIndex = 0;
      if (target === this.opponentHero) {
        targetType = 'hero';
      } else if (target instanceof Tower) {
        targetType = 'tower';
        targetIndex = target.team;
      } else if (target instanceof Crystal) {
        targetType = 'crystal';
        targetIndex = target.team;
      }
      this.network.sendGameEvent({
        action: 'basic_attack',
        targetType,
        targetIndex,
        targetId: target.id
      });
    }
  }

  handleSkillStartAim(skillId) {
    if (!this.playerHero || this.playerHero.isDead || this.playerHero.isStunned()) return;
    const cdKey = `s${skillId}`;
    if (this.playerHero.cds[cdKey] > 0) return;

    if (this.playerHero.heroType === 'arthur') {
      if (skillId === 2) this.playerHero.showAimIndicator('ring');
      else if (skillId === 3) this.playerHero.showAimIndicator('circle', 3.5);
    } else if (this.playerHero.heroType === 'daji') {
      if (skillId === 1) this.playerHero.showAimIndicator('arrow', 7);
      else if (skillId === 2) this.playerHero.showAimIndicator('circle', 5);
    } else if (this.playerHero.heroType === 'houyi') {
      if (skillId === 2) this.playerHero.showAimIndicator('circle', 5.5);
      else if (skillId === 3) this.playerHero.showAimIndicator('arrow', 25);
    }
  }

  handleSkillUpdateAim(skillId, aimVec, dist, isCancel) {
    if (!this.playerHero) return;
    this.playerHero.updateAimRotation(aimVec);
  }

  handleSkillCancel(skillId) {
    if (this.playerHero) {
      this.playerHero.hideAimIndicator();
    }
  }

  handleSkillCast(skillId, aimVec, isSmartCast) {
    if (!this.playerHero || this.playerHero.isDead || this.playerHero.isStunned()) return;
    this.playerHero.hideAimIndicator();

    const cdKey = `s${skillId}`;
    if (this.playerHero.cds[cdKey] > 0) return;

    // 智能锁敌默认朝向最近敌方英雄
    let castDir = { x: aimVec.x, z: aimVec.z };
    if (isSmartCast || (castDir.x === 0 && castDir.z === 0)) {
      if (this.opponentHero && !this.opponentHero.isDead) {
        const dx = this.opponentHero.mesh.position.x - this.playerHero.mesh.position.x;
        const dz = this.opponentHero.mesh.position.z - this.playerHero.mesh.position.z;
        const len = Math.hypot(dx, dz) || 1;
        castDir = { x: dx / len, z: dz / len };
      } else {
        castDir = { x: this.playerHero.team === 0 ? 1 : -1, z: 0 };
      }
    }

    const heroPos = this.playerHero.mesh.position;
    const enemyHero = this.opponentHero;

    // === 亚瑟技能释放 ===
    if (this.playerHero.heroType === 'arthur') {
      if (skillId === 1) {
        if (this.playerHero.castSkill1()) {
          this.sound.playArthurSkill1();
          this.floatingText.show(heroPos, '誓约之盾·加速冲锋!', 'heal');
        }
      } else if (skillId === 2) {
        if (this.playerHero.castSkill2()) {
          this.sound.playArthurSkill2();
        }
      } else if (skillId === 3) {
        const targetPos = enemyHero ? enemyHero.mesh.position : { x: heroPos.x + castDir.x * 3, z: heroPos.z + castDir.z * 3 };
        if (this.playerHero.castSkill3(targetPos)) {
          this.sound.playArthurSkill3();
          this.projectiles.spawnArthurSlamShockwave(targetPos);
          if (enemyHero && heroPos.distanceTo(targetPos) < 4.0) {
            enemyHero.applyStun(800);
            if (!this.isSinglePlayer) {
              enemyHero.takeOptimisticDamage(550);
              this.floatingText.show(enemyHero.mesh.position, `-550 圣剑斩杀!`, 'crit');
              this.network.sendGameEvent({
                action: 'hero_take_damage',
                amount: 550,
                type: 'physical',
                stun: 800
              });
            } else {
              const dmg = enemyHero.takeDamage(550, 'physical', this.playerHero);
              this.floatingText.show(enemyHero.mesh.position, `-${dmg} 圣剑斩杀!`, 'crit');
            }
          }
        }
      }
    }
    // === 妲己技能释放 ===
    else if (this.playerHero.heroType === 'daji') {
      if (skillId === 1) {
        if (this.playerHero.castSkill1()) {
          this.sound.playMagicCast();
          const enemies = this.getEnemyUnits(this.playerHero.team);
          this.projectiles.spawnDajiS1Wave(heroPos, castDir, 420, this.playerHero, enemies);
        }
      } else if (skillId === 2) {
        if (this.playerHero.castSkill2()) {
          this.sound.playDajiCharm();
          if (enemyHero && !enemyHero.isDead) {
            this.projectiles.spawnDajiCharm(heroPos, enemyHero, 280, this.playerHero);
            this.floatingText.show(enemyHero.mesh.position, '魅惑眩晕!', 'magic');
          }
        }
      } else if (skillId === 3) {
        if (this.playerHero.castSkill3()) {
          this.sound.playMagicCast();
          if (enemyHero && !enemyHero.isDead) {
            this.projectiles.spawnDajiFoxFire(heroPos, enemyHero, 220, this.playerHero);
          }
        }
      }
    }
    // === 后羿技能释放 ===
    else if (this.playerHero.heroType === 'houyi') {
      if (skillId === 1) {
        if (this.playerHero.castSkill1()) {
          this.floatingText.show(heroPos, '炙热之风·分裂射击!', 'crit');
        }
      } else if (skillId === 2) {
        if (this.playerHero.castSkill2()) {
          const strikePos = { x: heroPos.x + castDir.x * 3.5, z: heroPos.z + castDir.z * 3.5 };
          const enemies = this.getEnemyUnits(this.playerHero.team);
          this.projectiles.spawnHouyiSunStrike(strikePos, 350, this.playerHero, enemies);
        }
      } else if (skillId === 3) {
        if (this.playerHero.castSkill3()) {
          this.sound.playHouyiUlt();
          const enemies = this.getEnemyUnits(this.playerHero.team);
          this.projectiles.spawnHouyiUlt(heroPos, castDir, 580, this.playerHero, enemies, (hitHero) => {
            this.floatingText.show(hitHero.mesh.position, '眩晕大中!', 'crit');
          });
        }
      }
    }

    if (!this.isSinglePlayer) {
      this.network.sendGameEvent({
        action: 'skill_cast',
        skillId,
        castDir
      });
    }
  }

  handleRecall() {
    if (!this.playerHero || this.playerHero.isDead) return;
    this.playerHero.startRecall();
    this.floatingText.show(this.playerHero.mesh.position, '引导回城中...', 'heal');
  }

  handleHeal() {
    if (!this.playerHero || this.playerHero.isDead || this.playerHero.cds.heal > 0) return;
    this.playerHero.cds.heal = this.playerHero.cds.healMax;
    const healed = this.playerHero.heal(this.playerHero.maxHp * 0.25);
    this.floatingText.show(this.playerHero.mesh.position, `+${healed} 恢复`, 'heal');
  }

  handleSpell() {
    if (!this.playerHero || this.playerHero.isDead || this.playerHero.cds.spell > 0) return;
    this.playerHero.cds.spell = this.playerHero.cds.spellMax;

    // 终结 (斩杀)：对 2.1 米内敌方英雄造成已损生命值 16% 的真实伤害
    if (this.opponentHero && !this.opponentHero.isDead) {
      const dist = this.playerHero.mesh.position.distanceTo(this.opponentHero.mesh.position);
      if (dist <= 2.1) {
        const missingHp = this.opponentHero.maxHp - this.opponentHero.hp;
        const execDmg = Math.round(200 + missingHp * 0.16);
        if (!this.isSinglePlayer) {
          this.opponentHero.takeOptimisticDamage(execDmg);
          this.floatingText.show(this.opponentHero.mesh.position, `-${execDmg} 终结斩杀!`, 'crit');
          this.network.sendGameEvent({
            action: 'hero_take_damage',
            amount: execDmg,
            type: 'true'
          });
        } else {
          this.opponentHero.takeDamage(execDmg, 'true', this.playerHero);
          this.floatingText.show(this.opponentHero.mesh.position, `-${execDmg} 终结斩杀!`, 'crit');
        }
      }
    }
  }

  handleUpgradeSkill(skillId) {
    if (this.playerHero && this.playerHero.upgradeSkill(skillId)) {
      this.sound.playLevelUp();
    }
  }

  getEnemyUnits(myTeam) {
    const list = [];
    if (this.playerHero && this.playerHero.team !== myTeam && !this.playerHero.isDead) list.push(this.playerHero);
    if (this.opponentHero && this.opponentHero.team !== myTeam && !this.opponentHero.isDead) list.push(this.opponentHero);
    this.minions.forEach(m => {
      if (m.team !== myTeam && !m.isDead) list.push(m);
    });
    this.towers.forEach(t => {
      if (t.team !== myTeam && !t.isDead) list.push(t);
    });
    this.crystals.forEach(c => {
      if (c.team !== myTeam && !c.isDead) list.push(c);
    });
    return list;
  }

  handleCrystalDestroyed(loserTeam) {
    if (!this.isSinglePlayer && this.network) {
      this.network.sendGameEvent({
        action: 'crystal_destroyed',
        loserTeam: loserTeam
      });
    }
    const isVictory = loserTeam !== this.playerTeam;
    this.state = 'SETTLED';

    const settlementModal = document.getElementById('settlement-modal');
    const banner = document.getElementById('settlement-banner');
    const kdaEl = document.getElementById('settlement-kda');
    const timeEl = document.getElementById('settlement-time');
    const towersEl = document.getElementById('settlement-towers');

    if (isVictory) {
      banner.innerText = 'VICTORY 胜利';
      banner.className = 'settlement-title victory';
      this.sound.playVictory();
    } else {
      banner.innerText = 'DEFEAT 失败';
      banner.className = 'settlement-title defeat';
      this.sound.playDefeat();
    }

    if (kdaEl && this.playerHero) {
      kdaEl.innerText = `${this.playerHero.kills} / ${this.playerHero.deaths}`;
    }
    if (timeEl) {
      const m = Math.floor(this.matchTime / 60).toString().padStart(2, '0');
      const s = Math.floor(this.matchTime % 60).toString().padStart(2, '0');
      timeEl.innerText = `${m}:${s}`;
    }
    if (towersEl) {
      towersEl.innerText = `${this.towersDestroyed} 座`;
    }

    settlementModal.classList.add('active');
  }

  // === 主帧更新循环 ===
  animate(now) {
    requestAnimationFrame(this.animate);
    const delta = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    // 帧级别视口检测：杜绝任何横竖屏切换导致的尺寸黑边残余
    const curW = window.innerWidth || document.documentElement.clientWidth;
    const curH = window.innerHeight || document.documentElement.clientHeight;
    if (curW > 0 && curH > 0 && (curW !== this.lastViewportW || curH !== this.lastViewportH)) {
      this.updateViewportSize(curW, curH);
    }

    if (this.state === 'PLAYING') {
      this.updateBattle(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateBattle(delta) {
    this.matchTime += delta;

    // 1. 出兵波次计时
    this.waveTimer -= delta;
    if (this.waveTimer <= 0) {
      this.waveTimer = 25.0; // 25 秒出兵波次
      this.spawnMinionWave();
    }

    // 2. 玩家英雄移动与更新
    if (this.playerHero && !this.playerHero.isDead && !this.playerHero.isStunned()) {
      const move = this.playerHero.moveVector;
      if (move && (move.x !== 0 || move.z !== 0)) {
        this.playerHero.cancelRecall(); // 移动打断回城
        const effectiveSpeed = this.playerHero.speed * this.playerHero.speedMultiplier;
        this.playerHero.mesh.position.x += move.x * effectiveSpeed * delta;
        this.playerHero.mesh.position.z += move.z * effectiveSpeed * delta;
        this.playerHero.mesh.rotation.y = Math.atan2(move.x, move.z);
        this.map.clampPosition(this.playerHero.mesh.position);
      }
    }

    if (this.playerHero) {
      this.playerHero.update(delta);
      // 亚瑟2技能多段旋转范围伤害检测
      if (this.playerHero.heroType === 'arthur' && this.playerHero.s2ActiveTimer > 0) {
        this.playerHero.s2TickTimer = (this.playerHero.s2TickTimer || 0) + delta;
        if (this.playerHero.s2TickTimer >= 0.5) {
          this.playerHero.s2TickTimer = 0;
          const enemies = this.getEnemyUnits(this.playerHero.team);
          enemies.forEach(e => {
            if (!e.isDead && this.playerHero.mesh.position.distanceTo(e.mesh.position) <= 1.9) {
              if (!this.isSinglePlayer && e === this.opponentHero) {
                this.opponentHero.takeOptimisticDamage(120);
                this.floatingText.show(this.opponentHero.mesh.position, '-120', 'phys');
                this.network.sendGameEvent({
                  action: 'hero_take_damage',
                  amount: 120,
                  type: 'physical'
                });
              } else {
                const dmg = e.takeDamage(120, 'physical', this.playerHero);
                this.floatingText.show(e.mesh.position, `-${dmg}`, 'phys');
              }
            }
          });
        }
      }
    }

    // 3. 对手英雄更新
    if (this.opponentHero) {
      this.opponentHero.update(delta);
      this.map.clampPosition(this.opponentHero.mesh.position);

      // 单人模式 AI
      if (this.isSinglePlayer && this.botAI) {
        this.botAI.update(delta, this.minions, this.projectiles, this.sound);
      }
    }

    // 4. 防御塔 AI (仇恨判定与射击)
    this.towers.forEach(t => {
      t.update(delta);
      if (!t.isDead) {
        const enemies = this.getEnemyUnits(t.team);
        const target = t.evaluateTarget(enemies, null);
        if (target) {
          const now = Date.now() / 1000;
          if (now - t.lastAttackTime >= t.attackCooldown) {
            t.lastAttackTime = now;
            this.sound.playTowerShoot();
            const dmg = t.getCalculatedDamage();
            this.projectiles.spawnTowerProjectile(t.mesh.position, target, dmg, t);
          }
        }
      }
    });

    // 5. 基地水晶更新
    this.crystals.forEach(c => c.update(delta));

    // 6. 小兵移动与对抗
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      if (m.isDead) {
        // 小兵击杀奖励金币与经验
        if (this.playerHero && this.playerHero.mesh.position.distanceTo(m.mesh.position) < 14) {
          this.playerHero.gainGold(m.goldValue);
          const leveled = this.playerHero.gainExp(m.expValue);
          if (leveled) {
            this.sound.playLevelUp();
            this.floatingText.show(this.playerHero.mesh.position, '升级!', 'heal');
          }
          this.floatingText.show(m.mesh.position, `+${m.goldValue} 🪙`, 'crit');
        }
        m.destroy();
        this.minions.splice(i, 1);
        continue;
      }

      m.update(delta);
      const enemies = this.getEnemyUnits(m.team);
      const action = m.updateAI(enemies, delta);
      if (action && action.action === 'attack') {
        if (action.isRanged) {
          this.projectiles.spawnMagicBullet(m.mesh.position, action.target, m.attack, m, 0x38bdf8);
        } else {
          if (!this.isSinglePlayer && action.target === this.opponentHero) {
            // 联机模式小兵对对手英雄的近战伤害由对手客户端权威处理
          } else {
            action.target.takeDamage(m.attack, 'physical', m);
          }
        }
      }
    }

    // 7. 弹道飞行与碰撞
    this.projectiles.update(delta);

    // 8. 击杀判定与横幅
    this.checkHeroKillEvents();

    // 9. 摄像机平滑跟随玩家 (Lerp)
    if (this.playerHero) {
      const targetCamX = this.playerHero.mesh.position.x;
      const targetCamZ = this.playerHero.mesh.position.z + 14;
      this.camera.position.x += (targetCamX - this.camera.position.x) * 0.1;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.1;
      this.camera.lookAt(this.playerHero.mesh.position.x, 1.2, this.playerHero.mesh.position.z);
    }

    // 10. HUD 与小地图实时绘制
    this.hud.update(this.playerHero, this.matchTime, this.scoreBlue, this.scoreRed);
    this.miniMap.render({
      crystals: this.crystals,
      towers: this.towers,
      minions: this.minions,
      heroes: [this.playerHero, this.opponentHero].filter(Boolean)
    });

    // 11. 联机状态广播 (以 20Hz 频率同步位置、血量与生死状态)
    if (!this.isSinglePlayer && this.playerHero) {
      this.networkSyncTimer = (this.networkSyncTimer || 0) + delta;
      if (this.networkSyncTimer >= 0.05) {
        this.networkSyncTimer = 0;
        this.network.sendTransform({
          x: this.playerHero.mesh.position.x,
          z: this.playerHero.mesh.position.z,
          rotY: this.playerHero.mesh.rotation.y,
          hp: Math.max(0, this.playerHero.hp),
          maxHp: this.playerHero.maxHp,
          isDead: !!this.playerHero.isDead,
          level: this.playerHero.level,
          kills: this.playerHero.kills || 0,
          deaths: this.playerHero.deaths || 0,
          respawnTimer: this.playerHero.respawnTimer || 0
        });
      }
    }
  }

  checkHeroKillEvents() {
    // 敌方英雄死亡
    if (this.opponentHero && this.opponentHero.isDead && !this.opponentHero.killRecorded) {
      this.opponentHero.killRecorded = true;
      if (this.playerHero) {
        this.playerHero.kills += 1;
        this.playerHero.gainGold(200);
        this.playerHero.gainExp(250);
      }
      if (this.playerTeam === 0) {
        this.scoreBlue = this.playerHero ? this.playerHero.kills : 0;
        this.scoreRed = this.opponentHero ? this.opponentHero.kills : 0;
      } else {
        this.scoreBlue = this.opponentHero ? this.opponentHero.kills : 0;
        this.scoreRed = this.playerHero ? this.playerHero.kills : 0;
      }

      if (!this.firstBloodTaken) {
        this.firstBloodTaken = true;
        this.sound.playKillAnnouncement(true);
        this.hud.showBanner('第一滴血', 'First Blood');
      } else {
        this.sound.playKillAnnouncement(false);
        this.hud.showBanner('击败敌方英雄', 'You Have Slain An Enemy');
      }
    } else if (this.opponentHero && !this.opponentHero.isDead) {
      this.opponentHero.killRecorded = false;
    }

    // 我方英雄死亡
    if (this.playerHero && this.playerHero.isDead && !this.playerHero.killRecorded) {
      this.playerHero.killRecorded = true;
      if (this.opponentHero) this.opponentHero.kills += 1;
      if (this.playerTeam === 0) {
        this.scoreBlue = this.playerHero.kills;
        this.scoreRed = this.opponentHero ? this.opponentHero.kills : 0;
      } else {
        this.scoreBlue = this.opponentHero ? this.opponentHero.kills : 0;
        this.scoreRed = this.playerHero.kills;
      }
      this.hud.showBanner('你已被击败', 'You Have Been Slain');
      if (!this.isSinglePlayer) {
        this.network.sendGameEvent({ action: 'hero_died' });
      }
    } else if (this.playerHero && !this.playerHero.isDead) {
      if (this.playerHero.killRecorded && !this.isSinglePlayer) {
        this.network.sendGameEvent({ action: 'hero_respawned' });
      }
      this.playerHero.killRecorded = false;
    }
  }

  resetGame() {
    if (this.playerHero) { this.playerHero.destroy(); this.playerHero = null; }
    if (this.opponentHero) { this.opponentHero.destroy(); this.opponentHero = null; }
    this.towers.forEach(t => t.destroy());
    this.towers = [];
    this.crystals.forEach(c => c.destroy());
    this.crystals = [];
    this.minions.forEach(m => m.destroy());
    this.minions = [];
    this.projectiles.clear();

    this.matchTime = 0;
    this.scoreBlue = 0;
    this.scoreRed = 0;
    this.firstBloodTaken = false;
    this.towersDestroyed = 0;
    this.waveTimer = 4.0;
  }
}

// 页面加载完成后自启动 (兼容 DOMContentLoaded 已就绪情况)
function launchGame() {
  if (!window.game) {
    try {
      window.game = new Game();
    } catch (e) {
      console.error('Game initialization failed:', e);
      const box = document.getElementById('debug-err-box');
      if (box) {
        box.style.display = 'block';
        box.innerText = '⚠️ 游戏启动错误: ' + (e.message || e);
      }
    }
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', launchGame);
} else {
  launchGame();
}
