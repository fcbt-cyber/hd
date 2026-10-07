import * as THREE from '../../libs/three.module.js';
import { Hero } from './Hero.js';

/**
 * Houyi (后羿) - 半神之弓
 * 职业：射手 / 远程持续输出
 */
export class Houyi extends Hero {
  constructor(options = {}) {
    super({
      ...options,
      heroType: 'houyi',
      name: '后羿',
      maxHp: 2850,
      attack: 180,
      armor: 52,
      magicResist: 42,
      speed: 6.6,
      attackRange: 9.5,
      attackCooldown: 0.75
    });

    this.cds.s1Max = 6.0;
    this.cds.s2Max = 8.0;
    this.cds.s3Max = 25.0;

    // 1技能强化普攻状态
    this.s1ActiveTimer = 0;

    // 被动攻速层数 (0~3)
    this.passiveStacks = 0;
    this.passiveDecayTimer = 0;

    this.buildHouyiModel();
  }

  buildHouyiModel() {
    const goldOrange = 0xf97316;

    // 身体轻甲
    const torsoGeo = new THREE.CylinderGeometry(0.42, 0.38, 1.2, 8);
    const torsoMat = new THREE.MeshStandardMaterial({ color: goldOrange, metalness: 0.4 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.1;
    this.mesh.add(torso);

    // 头部
    const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffedd5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.0;
    this.mesh.add(head);

    // 金色束发羽冠
    const crownGeo = new THREE.ConeGeometry(0.15, 0.45, 4);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8 });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.set(0, 2.35, -0.1);
    this.mesh.add(crown);

    // 背部箭筒
    const quiverGeo = new THREE.CylinderGeometry(0.15, 0.12, 1.0, 6);
    const quiverMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const quiver = new THREE.Mesh(quiverGeo, quiverMat);
    quiver.position.set(0.2, 1.4, -0.4);
    quiver.rotation.z = Math.PI / 8;
    this.mesh.add(quiver);

    // 左手太阳神弓 (圆环截面弓身)
    this.bowGroup = new THREE.Group();
    const bowGeo = new THREE.TorusGeometry(0.8, 0.06, 8, 16, Math.PI);
    const bowMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      metalness: 0.8
    });
    const bow = new THREE.Mesh(bowGeo, bowMat);
    bow.rotation.z = Math.PI / 2;
    this.bowGroup.add(bow);

    this.bowGroup.position.set(-0.7, 1.3, 0.4);
    this.mesh.add(this.bowGroup);
  }

  // 释放1技能：炙热之风 (强化普攻，单次发射多重分裂箭)
  castSkill1() {
    if (this.cds.s1 > 0 || this.isSilenced() || this.isStunned()) return false;
    this.cds.s1 = this.cds.s1Max;
    this.s1ActiveTimer = 5.0;
    return true;
  }

  // 释放2技能：落日余晖 (召唤日光打击指定区域范围减速并伤害)
  castSkill2() {
    if (this.cds.s2 > 0 || this.isSilenced() || this.isStunned()) return false;
    this.cds.s2 = this.cds.s2Max;
    return true;
  }

  // 释放3技能：灼日之矢 (全图火焰神鸟巨箭)
  castSkill3() {
    if (this.cds.s3 > 0 || this.isSilenced() || this.isStunned()) return false;
    this.cds.s3 = this.cds.s3Max;
    return true;
  }

  // 普攻叠加被动
  onBasicAttackSuccess() {
    this.passiveStacks = Math.min(3, this.passiveStacks + 1);
    this.passiveDecayTimer = 3.0; // 3秒未普攻则重置层数
    this.attackCooldown = 0.75 - this.passiveStacks * 0.08; // 增加攻速
  }

  update(delta) {
    super.update(delta);

    // 1技能强化倒计时
    if (this.s1ActiveTimer > 0) {
      this.s1ActiveTimer -= delta;
      // 弓身发光更亮
      this.bowGroup.scale.set(1.15, 1.15, 1.15);
      if (this.s1ActiveTimer <= 0) {
        this.bowGroup.scale.set(1.0, 1.0, 1.0);
      }
    }

    // 被动层数衰减
    if (this.passiveDecayTimer > 0) {
      this.passiveDecayTimer -= delta;
      if (this.passiveDecayTimer <= 0) {
        this.passiveStacks = 0;
        this.attackCooldown = 0.75;
      }
    }
  }
}
