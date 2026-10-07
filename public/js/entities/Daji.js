import * as THREE from '../../libs/three.module.js';
import { Hero } from './Hero.js';

/**
 * Daji (妲己) - 魅力之狐
 * 职业：法师 / 爆发控制
 */
export class Daji extends Hero {
  constructor(options = {}) {
    super({
      ...options,
      heroType: 'daji',
      name: '妲己',
      maxHp: 2700,
      attack: 140,
      armor: 45,
      magicResist: 45,
      speed: 6.5,
      attackRange: 8.5,
      attackCooldown: 1.0
    });

    this.cds.s1Max = 5.5;
    this.cds.s2Max = 9.0;
    this.cds.s3Max = 18.0;

    this.buildDajiModel();
  }

  buildDajiModel() {
    const mainPink = 0xf43f5e;

    // 优雅裙摆
    const dressGeo = new THREE.ConeGeometry(0.65, 1.4, 8);
    const dressMat = new THREE.MeshStandardMaterial({ color: mainPink, roughness: 0.4 });
    const dress = new THREE.Mesh(dressGeo, dressMat);
    dress.position.y = 0.7;
    this.mesh.add(dress);

    // 上半身
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.8, 8);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0xbe185d });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.6;
    this.mesh.add(torso);

    // 头部
    const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.25;
    this.mesh.add(head);

    // 狐狸耳朵 (左右)
    [-0.22, 0.22].forEach(x => {
      const earGeo = new THREE.ConeGeometry(0.14, 0.4, 4);
      const earMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e });
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(x, 2.6, 0);
      ear.rotation.z = x > 0 ? -0.2 : 0.2;
      this.mesh.add(ear);
    });

    // 蓬松狐狸大尾巴
    this.tail = new THREE.Group();
    const tailGeo = new THREE.ConeGeometry(0.4, 1.4, 6);
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.7 });
    const tailMesh = new THREE.Mesh(tailGeo, tailMat);
    tailMesh.position.set(0, 0.6, -0.6);
    tailMesh.rotation.x = -Math.PI / 3;
    this.tail.add(tailMesh);
    this.mesh.add(this.tail);

    // 悬浮法球 (随呼吸脉动)
    const orbGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xec4899,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9
    });
    this.magicOrb = new THREE.Mesh(orbGeo, orbMat);
    this.magicOrb.position.set(0.5, 1.6, 0.6);
    this.mesh.add(this.magicOrb);
  }

  // 释放1技能：灵魂冲击 (直线远距离法术冲击波)
  castSkill1() {
    if (this.cds.s1 > 0 || this.isSilenced() || this.isStunned()) return false;
    this.cds.s1 = this.cds.s1Max;
    return true;
  }

  // 释放2技能：偶像魅力 (爱心追踪眩晕)
  castSkill2() {
    if (this.cds.s2 > 0 || this.isSilenced() || this.isStunned()) return false;
    this.cds.s2 = this.cds.s2Max;
    return true;
  }

  // 释放3技能：女王崇拜 (5团连续狐火法球爆发)
  castSkill3() {
    if (this.cds.s3 > 0 || this.isSilenced() || this.isStunned()) return false;
    this.cds.s3 = this.cds.s3Max;
    return true;
  }

  update(delta) {
    super.update(delta);

    // 尾巴与法球随时间摆动
    if (this.tail) {
      this.tail.rotation.y = Math.sin(Date.now() * 0.004) * 0.25;
    }
    if (this.magicOrb) {
      this.magicOrb.position.y = 1.6 + Math.sin(Date.now() * 0.006) * 0.12;
    }
  }
}
