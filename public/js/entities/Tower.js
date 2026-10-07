import * as THREE from '../../libs/three.module.js';
import { Entity } from './Entity.js';

/**
 * Tower - 防御塔
 * 具备经典王者荣耀仇恨锁定机制（优先清兵，当敌方英雄在塔下攻击友方英雄时瞬间仇恨转移并警报）
 */
export class Tower extends Entity {
  constructor(options = {}) {
    super({
      ...options,
      name: options.team === 0 ? '蓝方外塔' : '红方外塔',
      maxHp: 6500,
      attack: 460,
      armor: 140,
      magicResist: 120,
      speed: 0,
      attackRange: 11.5,
      attackCooldown: 1.2,
      radius: 2.2
    });

    this.currentTarget = null;
    this.consecutiveHitsOnHero = 0; // 连续攻击英雄伤害递增
    this.rangeIndicator = null;

    this.buildTowerModel();
    this.createRangeIndicator();
  }

  buildTowerModel() {
    const teamColor = this.team === 0 ? 0x3b82f6 : 0xef4444;

    // 石质基座
    const baseGeo = new THREE.CylinderGeometry(2.0, 2.4, 1.2, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.6;
    this.mesh.add(baseMesh);

    // 塔身中段
    const pillarGeo = new THREE.CylinderGeometry(1.4, 1.8, 3.6, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
    pillarMesh.position.y = 3.0;
    this.mesh.add(pillarMesh);

    // 塔顶雕花台
    const topPlateGeo = new THREE.CylinderGeometry(1.8, 1.3, 0.8, 8);
    const topPlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const topPlate = new THREE.Mesh(topPlateGeo, topPlateMat);
    topPlate.position.y = 5.2;
    this.mesh.add(topPlate);

    // 塔顶悬浮水晶能量核心
    const coreGeo = new THREE.OctahedronGeometry(0.85, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: teamColor,
      emissive: teamColor,
      emissiveIntensity: 0.9,
      roughness: 0.1
    });
    this.energyCore = new THREE.Mesh(coreGeo, coreMat);
    this.energyCore.position.y = 6.4;
    this.mesh.add(this.energyCore);

    // 调整血条高度
    if (this.hpSprite) {
      this.hpSprite.position.y = 8.2;
      this.hpSprite.scale.set(4.5, 0.6, 1);
    }
  }

  createRangeIndicator() {
    const ringGeo = new THREE.RingGeometry(this.attackRange - 0.15, this.attackRange, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: this.team === 0 ? 0x60a5fa : 0xf87171,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    this.rangeIndicator = new THREE.Mesh(ringGeo, ringMat);
    this.rangeIndicator.position.y = 0.04;
    this.mesh.add(this.rangeIndicator);
  }

  // 仇恨选择：如果有敌方英雄攻击我方英雄，优先锁定该敌方英雄；否则优先攻击最近的小兵
  evaluateTarget(enemies, friendlyHeroAttackedBy) {
    if (this.isDead) {
      this.currentTarget = null;
      return null;
    }

    const inRangeEnemies = enemies.filter(e => {
      if (e.isDead) return false;
      const dist = this.mesh.position.distanceTo(e.mesh.position);
      return dist <= this.attackRange;
    });

    if (inRangeEnemies.length === 0) {
      this.currentTarget = null;
      this.consecutiveHitsOnHero = 0;
      return null;
    }

    // 1. 越塔保护：若有敌方英雄在塔下攻击了我方英雄
    if (friendlyHeroAttackedBy && inRangeEnemies.includes(friendlyHeroAttackedBy)) {
      if (this.currentTarget !== friendlyHeroAttackedBy) {
        this.consecutiveHitsOnHero = 0;
      }
      this.currentTarget = friendlyHeroAttackedBy;
      return this.currentTarget;
    }

    // 2. 如果当前锁定目标依然在范围内，继续保持攻击
    if (this.currentTarget && inRangeEnemies.includes(this.currentTarget)) {
      return this.currentTarget;
    }

    // 3. 优先锁定小兵
    const minions = inRangeEnemies.filter(e => e.isMinion);
    if (minions.length > 0) {
      // 距离最近的小兵
      minions.sort((a, b) => {
        return this.mesh.position.distanceTo(a.mesh.position) - this.mesh.position.distanceTo(b.mesh.position);
      });
      this.currentTarget = minions[0];
      this.consecutiveHitsOnHero = 0;
      return this.currentTarget;
    }

    // 4. 没有小兵，锁定最近的敌方英雄
    inRangeEnemies.sort((a, b) => {
      return this.mesh.position.distanceTo(a.mesh.position) - this.mesh.position.distanceTo(b.mesh.position);
    });
    this.currentTarget = inRangeEnemies[0];
    this.consecutiveHitsOnHero = 0;
    return this.currentTarget;
  }

  getCalculatedDamage() {
    let dmg = this.attack;
    if (this.currentTarget && !this.currentTarget.isMinion) {
      // 连续攻击英雄递增伤害 (+25% 每次，最高 +100%)
      const bonusPct = Math.min(1.0, this.consecutiveHitsOnHero * 0.25);
      dmg = Math.round(dmg * (1 + bonusPct));
      this.consecutiveHitsOnHero++;
    }
    return dmg;
  }

  update(delta) {
    super.update(delta);

    // 能量核心缓慢旋转脉动
    if (this.energyCore && !this.isDead) {
      this.energyCore.rotation.y += delta * 1.5;
      this.energyCore.position.y = 6.4 + Math.sin(Date.now() * 0.003) * 0.15;
    }
  }

  die(killer) {
    super.die(killer);
    if (this.energyCore) {
      this.energyCore.visible = false;
    }
    if (this.rangeIndicator) {
      this.rangeIndicator.visible = false;
    }
  }
}
