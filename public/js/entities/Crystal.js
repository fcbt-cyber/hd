import * as THREE from '../../libs/three.module.js';
import { Entity } from './Entity.js';

/**
 * Crystal - 基地水晶 (终极推塔胜利目标)
 */
export class Crystal extends Entity {
  constructor(options = {}) {
    super({
      ...options,
      name: options.team === 0 ? '蓝方水晶' : '红方水晶',
      maxHp: 9000,
      attack: 520,
      armor: 110,
      magicResist: 90,
      speed: 0,
      attackRange: 9.5,
      attackCooldown: 1.1,
      radius: 3.0
    });

    this.isCrystal = true;
    this.onDestroyed = options.onDestroyed || (() => {});

    this.buildCrystalModel();
  }

  buildCrystalModel() {
    const teamColor = this.team === 0 ? 0x2563eb : 0xdc2626;

    // 水晶基座
    const baseGeo = new THREE.CylinderGeometry(2.8, 3.2, 1.0, 6);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.5;
    this.mesh.add(baseMesh);

    // 悬浮旋转巨大主水晶柱
    const crystalGeo = new THREE.OctahedronGeometry(1.8, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: teamColor,
      emissive: teamColor,
      emissiveIntensity: 0.85,
      roughness: 0.1,
      transparent: true,
      opacity: 0.95
    });
    this.crystalShard = new THREE.Mesh(crystalGeo, crystalMat);
    this.crystalShard.scale.set(1.0, 2.2, 1.0); // 向上拉伸呈尖锐巨石
    this.crystalShard.position.y = 4.2;
    this.mesh.add(this.crystalShard);

    // 环绕光环
    const ringGeo = new THREE.RingGeometry(2.2, 2.5, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: teamColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    });
    this.glowRing = new THREE.Mesh(ringGeo, ringMat);
    this.glowRing.position.y = 4.2;
    this.mesh.add(this.glowRing);

    // 头顶血条调整
    if (this.hpSprite) {
      this.hpSprite.position.y = 7.5;
      this.hpSprite.scale.set(5.5, 0.65, 1);
    }
  }

  update(delta) {
    super.update(delta);

    if (this.crystalShard && !this.isDead) {
      this.crystalShard.rotation.y += delta * 1.2;
      this.crystalShard.position.y = 4.2 + Math.sin(Date.now() * 0.002) * 0.2;
    }
    if (this.glowRing && !this.isDead) {
      this.glowRing.rotation.z += delta * 0.8;
    }
  }

  die(killer) {
    super.die(killer);
    if (this.crystalShard) {
      this.crystalShard.visible = false;
    }
    this.onDestroyed(this.team, killer);
  }
}
