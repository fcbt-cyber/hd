import * as THREE from '../../libs/three.module.js';
import { Hero } from './Hero.js';

/**
 * Arthur (亚瑟) - 圣骑之力
 * 职业：战士 / 坦克
 */
export class Arthur extends Hero {
  constructor(options = {}) {
    super({
      ...options,
      heroType: 'arthur',
      name: '亚瑟',
      maxHp: 3400,
      attack: 165,
      armor: 70,
      magicResist: 45,
      speed: 6.8,
      attackRange: 2.8,
      attackCooldown: 0.85
    });

    // 技能 CD 参数
    this.cds.s1Max = 8;
    this.cds.s2Max = 9;
    this.cds.s3Max = 22;

    // 1技能冲锋与跳斩强化
    this.s1ActiveTimer = 0;
    this.s1Empowered = false;

    // 2技能圣盾旋转
    this.s2ActiveTimer = 0;
    this.s2TickTimer = 0;

    // 3技能大招跳斩飞行中
    this.isSlamming = false;
    this.slamTargetPos = null;
    this.slamProgress = 0;

    // 被动每 2 秒回复 2% 生命
    this.passiveRegenTimer = 0;

    this.buildArthurModel();
    this.buildSkill2Shields();
  }

  buildArthurModel() {
    const teamColor = this.team === 0 ? 0x2563eb : 0xdc2626;

    // 身体铠甲
    const bodyGeo = new THREE.CylinderGeometry(0.55, 0.45, 1.3, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: teamColor, metalness: 0.6, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.15;
    this.mesh.add(body);

    // 头部重盔
    const headGeo = new THREE.SphereGeometry(0.38, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.05;
    this.mesh.add(head);

    // 金色头盔翎羽
    const crestGeo = new THREE.BoxGeometry(0.08, 0.3, 0.45);
    const crestMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5 });
    const crest = new THREE.Mesh(crestGeo, crestMat);
    crest.position.set(0, 2.3, 0);
    this.mesh.add(crest);

    // 金色肩甲 (左右)
    [-0.75, 0.75].forEach(x => {
      const shoulderGeo = new THREE.BoxGeometry(0.4, 0.35, 0.5);
      const shoulderMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.7 });
      const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
      shoulder.position.set(x, 1.65, 0);
      this.mesh.add(shoulder);
    });

    // 右手圣剑
    this.swordGroup = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(0.12, 1.6, 0.25);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.8;
    this.swordGroup.add(blade);

    const guardGeo = new THREE.BoxGeometry(0.2, 0.12, 0.6);
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8 });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    this.swordGroup.add(guard);

    this.swordGroup.position.set(0.8, 1.2, 0.3);
    this.swordGroup.rotation.x = Math.PI / 6;
    this.mesh.add(this.swordGroup);

    // 左手圣盾
    const shieldGeo = new THREE.BoxGeometry(0.1, 1.1, 0.7);
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.5, roughness: 0.3 });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(-0.8, 1.2, 0.2);
    this.mesh.add(shield);
  }

  buildSkill2Shields() {
    this.s2Group = new THREE.Group();
    this.s2Group.visible = false;
    this.s2Group.position.y = 1.2;

    this.shieldBlades = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const bladeGeo = new THREE.BoxGeometry(0.08, 0.45, 0.65);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.6
      });
      const shield = new THREE.Mesh(bladeGeo, bladeMat);
      shield.position.set(Math.cos(angle) * 1.6, 0, Math.sin(angle) * 1.6);
      shield.rotation.y = angle;
      this.s2Group.add(shield);
      this.shieldBlades.push(shield);
    }
    this.mesh.add(this.s2Group);
  }

  // 释放1技能：誓约之盾 (冲锋提速并强化下次攻击)
  castSkill1() {
    if (this.cds.s1 > 0 || this.isSilenced() || this.isStunned()) return false;
    this.cds.s1 = this.cds.s1Max;
    this.s1ActiveTimer = 3.5;
    this.s1Empowered = true;
    this.speedMultiplier = 1.35; // 提高 35% 移速
    this.swordGroup.scale.set(1.2, 1.4, 1.2); // 圣剑闪耀变大
    return true;
  }

  // 释放2技能：回旋打击 (圣盾围绕周身旋转多段范围伤害)
  castSkill2() {
    if (this.cds.s2 > 0 || this.isSilenced() || this.isStunned()) return false;
    this.cds.s2 = this.cds.s2Max;
    this.s2ActiveTimer = 5.0;
    this.s2Group.visible = true;
    return true;
  }

  // 释放3技能：圣剑裁决 (大招砸地击飞)
  castSkill3(targetPos) {
    if (this.cds.s3 > 0 || this.isSilenced() || this.isStunned()) return false;
    this.cds.s3 = this.cds.s3Max;
    this.isSlamming = true;
    this.slamTargetPos = {
      x: targetPos ? targetPos.x : this.mesh.position.x,
      z: targetPos ? targetPos.z : this.mesh.position.z - 2.5
    };
    this.slamProgress = 0;
    return true;
  }

  update(delta) {
    super.update(delta);

    // 被动自然回血
    this.passiveRegenTimer += delta;
    if (this.passiveRegenTimer >= 2.0 && !this.isDead) {
      this.passiveRegenTimer = 0;
      this.heal(Math.round(this.maxHp * 0.02));
    }

    // 1技能倒计时
    if (this.s1ActiveTimer > 0) {
      this.s1ActiveTimer -= delta;
      if (this.s1ActiveTimer <= 0) {
        this.s1Empowered = false;
        this.speedMultiplier = 1.0;
        this.swordGroup.scale.set(1, 1, 1);
      }
    }

    // 2技能圣盾旋转
    if (this.s2ActiveTimer > 0) {
      this.s2ActiveTimer -= delta;
      this.s2Group.rotation.y += delta * 6.0; // 快速旋转
      if (this.s2ActiveTimer <= 0) {
        this.s2Group.visible = false;
      }
    }

    // 3技能跳斩推进动画
    if (this.isSlamming && this.slamTargetPos) {
      this.slamProgress += delta * 2.5;
      if (this.slamProgress >= 1.0) {
        this.isSlamming = false;
        this.mesh.position.x = this.slamTargetPos.x;
        this.mesh.position.z = this.slamTargetPos.z;
        this.mesh.position.y = 0;
      } else {
        // 抛物线跳跃
        const t = this.slamProgress;
        this.mesh.position.x += (this.slamTargetPos.x - this.mesh.position.x) * t;
        this.mesh.position.z += (this.slamTargetPos.z - this.mesh.position.z) * t;
        this.mesh.position.y = Math.sin(t * Math.PI) * 4.0;
      }
    }
  }
}
