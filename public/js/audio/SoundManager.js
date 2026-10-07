/**
 * SoundManager - 基于 Web Audio API 的程序化 MOBA 音效合成器
 * 无需外部音频文件加载，低延迟、100% 本地即时响应
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    } catch (e) {
      console.warn('AudioContext init skipped', e);
    }
  }

  ensureContext() {
    try {
      if (!this.ctx) {
        this.initAudioContext();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {}
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // 普攻剑斩
  playAttackSlash() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  // 弓箭破空射击
  playBowShoot() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.15);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // 魔法施法/法球发射
  playMagicCast() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.2);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  // 受击打击音效
  playHit() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  // 防御塔射击
  playTowerShoot() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.25);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  // 技能释放音效：亚瑟1技能（冲锋护盾跃起）
  playArthurSkill1() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(550, t + 0.18);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  // 亚瑟2技能（圣盾旋转）
  playArthurSkill2() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.1);
    osc.frequency.linearRampToValueAtTime(300, t + 0.2);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // 亚瑟大招（圣剑裁决巨剑砸地）
  playArthurSkill3() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    // 重低音轰鸣
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.45);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  // 妲己2技能（爱心魅惑锁定）
  playDajiCharm() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // 后羿大招（灼日之矢飞翔发射）
  playHouyiUlt() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.2);
    osc.frequency.linearRampToValueAtTime(700, t + 0.4);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  // 击杀音效 / First Blood
  playKillAnnouncement(isFirstBlood = false) {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // 激昂的号角/弦音
    const notes = isFirstBlood ? [261.6, 329.6, 392.0, 523.25] : [329.6, 392.0, 523.25];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.1);

      gain.gain.setValueAtTime(0.35, t + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.1 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + idx * 0.1);
      osc.stop(t + idx * 0.1 + 0.35);
    });
  }

  // 升级音效
  playLevelUp() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    [440, 554, 659, 880].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);

      gain.gain.setValueAtTime(0.2, t + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.06 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.2);
    });
  }

  // 购买装备金币碰撞声
  playBuyItem() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.setValueAtTime(1800, t + 0.06);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // 胜利号角
  playVictory() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C Major
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.12);

      gain.gain.setValueAtTime(0.4, t + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + idx * 0.12);
      osc.stop(t + idx * 0.12 + 1.2);
    });
  }

  // 失败低鸣
  playDefeat() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const chord = [392.0, 370.0, 329.6, 293.66];
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + idx * 0.2);

      gain.gain.setValueAtTime(0.3, t + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.2 + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + idx * 0.2);
      osc.stop(t + idx * 0.2 + 0.8);
    });
  }
}
