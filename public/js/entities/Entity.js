import * as THREE from '../../libs/three.module.js';

/**
 * Entity - 战斗单位基础类
 */
export class Entity {
  constructor(options = {}) {
    this.id = options.id || ('unit_' + Math.random().toString(36).substr(2, 9));
    this.name = options.name || 'Unit';
    this.team = options.team !== undefined ? options.team : 0; // 0: 蓝方, 1: 红方
    this.scene = options.scene;

    // 基础属性
    this.maxHp = options.maxHp || 1000;
    this.hp = this.maxHp;
    this.maxMp = options.maxMp || 500;
    this.mp = this.maxMp;
    this.attack = options.attack || 80;
    this.armor = options.armor || 20;
    this.magicResist = options.magicResist || 15;
    this.speed = options.speed || 6.5;
    this.attackRange = options.attackRange || 2.5;
    this.attackCooldown = options.attackCooldown || 0.9;
    this.lastAttackTime = 0;

    // 状态标志
    this.isDead = false;
    this.stunnedUntil = 0;
    this.silencedUntil = 0;
    this.slowedUntil = 0;
    this.speedMultiplier = 1.0;

    // 3D 渲染对象
    this.mesh = new THREE.Group();
    this.mesh.position.set(options.x || 0, options.y || 0, options.z || 0);
    if (this.scene) {
      this.scene.add(this.mesh);
    }

    // 碰撞半径
    this.radius = options.radius || 1.0;

    // 头顶血条精灵
    this.createHealthBarSprite();
  }

  createHealthBarSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 20;
    this.hpCanvas = canvas;
    this.hpCtx = canvas.getContext('2d');

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    this.hpSprite = new THREE.Sprite(spriteMaterial);
    this.hpSprite.scale.set(3, 0.45, 1);
    this.hpSprite.position.y = 3.2; // 悬浮于头顶
    this.mesh.add(this.hpSprite);

    this.updateHpSprite();
  }

  updateHpSprite() {
    if (!this.hpCtx) return;
    const ctx = this.hpCtx;
    const w = this.hpCanvas.width;
    const h = this.hpCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // 外边框
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // 血量百分比
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    ctx.fillStyle = this.team === 0 ? '#10b981' : '#ef4444'; // 友军绿/蓝，敌军红
    ctx.fillRect(2, 2, (w - 4) * pct, h - 4);

    // 刻度线 (每 1000 血一格)
    const segments = Math.floor(this.maxHp / 800);
    if (segments > 1) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      for (let i = 1; i < segments; i++) {
        const x = 2 + (w - 4) * (i / segments);
        ctx.fillRect(x, 2, 2, h - 4);
      }
    }

    this.hpSprite.material.map.needsUpdate = true;
  }

  isStunned() {
    return Date.now() < this.stunnedUntil;
  }

  isSilenced() {
    return Date.now() < this.silencedUntil;
  }

  takeDamage(amount, type = 'physical', attacker = null) {
    if (this.isDead) return 0;

    // 护甲/魔抗减免公式：实际伤害 = 伤害 * (600 / (600 + 防御))
    let finalDmg = amount;
    if (type === 'physical') {
      const reduction = 600 / (600 + Math.max(0, this.armor));
      finalDmg = Math.round(amount * reduction);
    } else if (type === 'magic') {
      const reduction = 600 / (600 + Math.max(0, this.magicResist));
      finalDmg = Math.round(amount * reduction);
    } else if (type === 'true') {
      finalDmg = Math.round(amount); // 真实伤害无视护甲
    }

    finalDmg = Math.max(1, finalDmg);
    this.hp = Math.max(0, this.hp - finalDmg);
    this.updateHpSprite();

    // 触发受击轻微泛红特效
    this.flashHit();

    if (this.hp <= 0) {
      this.die(attacker);
    }

    return finalDmg;
  }

  heal(amount) {
    if (this.isDead) return 0;
    const actual = Math.min(amount, this.maxHp - this.hp);
    this.hp += actual;
    this.updateHpSprite();
    return actual;
  }

  flashHit() {
    this.mesh.traverse((child) => {
      if (child.isMesh && child.material && child.material.color) {
        const originalHex = child.material.userData.origColor || child.material.color.getHex();
        child.material.userData.origColor = originalHex;
        child.material.color.setHex(0xff3333);
        setTimeout(() => {
          if (child.material) child.material.color.setHex(originalHex);
        }, 120);
      }
    });
  }

  applyStun(durationMs) {
    this.stunnedUntil = Math.max(this.stunnedUntil, Date.now() + durationMs);
  }

  applySilence(durationMs) {
    this.silencedUntil = Math.max(this.silencedUntil, Date.now() + durationMs);
  }

  applySlow(durationMs, factor = 0.5) {
    this.slowedUntil = Date.now() + durationMs;
    this.speedMultiplier = factor;
  }

  die(killer) {
    this.isDead = true;
    this.hp = 0;
    this.updateHpSprite();
  }

  update(delta) {
    if (this.slowedUntil && Date.now() > this.slowedUntil) {
      this.slowedUntil = 0;
      this.speedMultiplier = 1.0;
    }
  }

  destroy() {
    if (this.scene && this.mesh) {
      this.scene.remove(this.mesh);
    }
  }
}
