import * as THREE from '../../libs/three.module.js';
import { Entity } from './Entity.js';

/**
 * Minion - 小兵单位 (近战兵 / 远程兵)
 */
export class Minion extends Entity {
  constructor(options = {}) {
    const isRanged = options.minionType === 'ranged';
    super({
      ...options,
      name: isRanged ? '远程法师小兵' : '近战步兵小兵',
      maxHp: isRanged ? 700 : 1000,
      attack: isRanged ? 75 : 55,
      armor: isRanged ? 20 : 35,
      magicResist: isRanged ? 25 : 20,
      speed: 4.2,
      attackRange: isRanged ? 6.5 : 2.0,
      attackCooldown: isRanged ? 1.1 : 0.95,
      radius: 0.8
    });

    this.isMinion = true;
    this.minionType = options.minionType || 'melee';
    this.goldValue = isRanged ? 42 : 48;
    this.expValue = 55;

    this.target = null;
    this.buildMinionModel();
  }

  buildMinionModel() {
    const teamColor = this.team === 0 ? 0x3b82f6 : 0xef4444;

    if (this.minionType === 'melee') {
      // 近战盔甲小兵
      const bodyGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.8, 6);
      const bodyMat = new THREE.MeshStandardMaterial({ color: teamColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.6;
      this.mesh.add(body);

      // 头盔
      const headGeo = new THREE.SphereGeometry(0.25, 6, 6);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.15;
      this.mesh.add(head);

      // 小短剑
      const swordGeo = new THREE.BoxGeometry(0.08, 0.6, 0.12);
      const swordMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
      const sword = new THREE.Mesh(swordGeo, swordMat);
      sword.position.set(0.45, 0.6, 0.2);
      this.mesh.add(sword);

      // 小圆盾
      const shieldGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 8);
      shieldGeo.rotateX(Math.PI / 2);
      const shieldMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.set(-0.45, 0.6, 0.2);
      this.mesh.add(shield);
    } else {
      // 远程法袍小兵
      const robeGeo = new THREE.ConeGeometry(0.4, 0.9, 6);
      const robeMat = new THREE.MeshStandardMaterial({ color: teamColor });
      const robe = new THREE.Mesh(robeGeo, robeMat);
      robe.position.y = 0.55;
      this.mesh.add(robe);

      // 兜帽头
      const headGeo = new THREE.SphereGeometry(0.22, 6, 6);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.1;
      this.mesh.add(head);

      // 法杖
      const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 4);
      const staffMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const staff = new THREE.Mesh(staffGeo, staffMat);
      staff.position.set(0.4, 0.6, 0.2);
      this.mesh.add(staff);

      // 法杖顶端小宝石
      const gemGeo = new THREE.OctahedronGeometry(0.1, 0);
      const gemMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308 });
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.set(0.4, 1.1, 0.2);
      this.mesh.add(gem);
    }

    // 血条缩放
    if (this.hpSprite) {
      this.hpSprite.position.y = 1.8;
      this.hpSprite.scale.set(1.8, 0.3, 1);
    }
  }

  // 寻找索敌目标与推进
  updateAI(enemies, delta) {
    if (this.isDead || this.isStunned()) return null;

    // 查找范围内最近有效敌人
    let closestEnemy = null;
    let minDist = 999;

    enemies.forEach(e => {
      if (!e.isDead) {
        const d = this.mesh.position.distanceTo(e.mesh.position);
        if (d < minDist) {
          minDist = d;
          closestEnemy = e;
        }
      }
    });

    this.target = closestEnemy;

    if (this.target && minDist <= this.attackRange) {
      // 已经进入射程，停步并准备攻击
      // 面向敌人
      const angle = Math.atan2(
        this.target.mesh.position.x - this.mesh.position.x,
        this.target.mesh.position.z - this.mesh.position.z
      );
      this.mesh.rotation.y = angle;

      const now = Date.now() / 1000;
      if (now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        return { action: 'attack', target: this.target, isRanged: this.minionType === 'ranged' };
      }
    } else if (this.target && minDist < 9.0) {
      // 敌人未在射程但靠近，向敌人移动
      const dx = this.target.mesh.position.x - this.mesh.position.x;
      const dz = this.target.mesh.position.z - this.mesh.position.z;
      const len = Math.hypot(dx, dz) || 1;
      this.mesh.position.x += (dx / len) * this.speed * delta;
      this.mesh.position.z += (dz / len) * this.speed * delta;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    } else {
      // 沿单路推线前进 (蓝方向 +X，红方向 -X)
      const dirX = this.team === 0 ? 1 : -1;
      this.mesh.position.x += dirX * this.speed * delta;
      this.mesh.rotation.y = dirX > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    return null;
  }
}
