import * as THREE from '../../libs/three.module.js';
import { Entity } from './Entity.js';

/**
 * Hero - 英雄基类 (继承自 Entity)
 * 包含经验升级、技能冷却、装备数值增益、回城与召唤师技能机制
 */
export class Hero extends Entity {
  constructor(options = {}) {
    super(options);
    this.heroType = options.heroType || 'arthur';

    // 等级与经济
    this.level = 1;
    this.exp = 0;
    this.expNeeded = 200;
    this.gold = options.gold || 300;
    this.skillPoints = 1;
    this.skillLevels = [1, 0, 0]; // 1技能、2技能、大招3技能等级

    // 装备槽位 (最多 6 件)
    this.items = [];

    // 技能冷却 (秒)
    this.cds = {
      s1: 0, s1Max: 8,
      s2: 0, s2Max: 10,
      s3: 0, s3Max: 25,
      spell: 0, spellMax: 60,
      heal: 0, healMax: 60,
      recall: 0, recallMax: 0
    };

    // 回城引导状态
    this.isRecalling = false;
    this.recallTimer = 0;
    this.recallDuration = 4.5; // 4.5 秒回城

    // 复活机制
    this.respawnTimer = 0;
    this.respawnDuration = 6;
    this.spawnPoint = {
      x: options.team === 0 ? -45 : 45,
      z: 0
    };

    // 击杀数据
    this.kills = 0;
    this.deaths = 0;

    // 瞄准地面投影指示器网格
    this.createAimIndicators();
  }

  createAimIndicators() {
    this.indicatorGroup = new THREE.Group();
    this.indicatorGroup.visible = false;
    this.indicatorGroup.position.y = 0.05; // 紧贴地面

    // 1. 直线箭头指示器 (用于妲己1技能 / 后羿大招)
    const arrowGeo = new THREE.PlaneGeometry(1.2, 8);
    arrowGeo.rotateX(-Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    this.arrowIndicator = new THREE.Mesh(arrowGeo, arrowMat);
    this.arrowIndicator.position.z = -4; // 向前延伸 (原为 -8)
    this.indicatorGroup.add(this.arrowIndicator);

    // 2. 圆形范围指示器 (用于亚瑟大招 / 后羿2技能)
    const circleGeo = new THREE.RingGeometry(0.1, 2.25, 32);
    circleGeo.rotateX(-Math.PI / 2);
    const circleMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    this.circleIndicator = new THREE.Mesh(circleGeo, circleMat);
    this.indicatorGroup.add(this.circleIndicator);

    // 3. 自身范围光圈 (用于亚瑟2技能旋转圣盾)
    const selfRingGeo = new THREE.RingGeometry(1.8, 2.0, 32);
    selfRingGeo.rotateX(-Math.PI / 2);
    const selfRingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    this.selfRingIndicator = new THREE.Mesh(selfRingGeo, selfRingMat);
    this.indicatorGroup.add(this.selfRingIndicator);

    this.mesh.add(this.indicatorGroup);
  }

  showAimIndicator(type = 'arrow', range = 12) {
    this.indicatorGroup.visible = true;
    this.arrowIndicator.visible = type === 'arrow';
    this.circleIndicator.visible = type === 'circle';
    this.selfRingIndicator.visible = type === 'ring';
  }

  hideAimIndicator() {
    this.indicatorGroup.visible = false;
  }

  updateAimRotation(aimVec) {
    if (!aimVec || (aimVec.x === 0 && aimVec.z === 0)) return;
    const angle = Math.atan2(aimVec.x, aimVec.z);
    // 旋转指示器朝向
    this.arrowIndicator.rotation.y = angle + Math.PI;
  }

  gainExp(amount) {
    if (this.level >= 15) return false;
    this.exp += amount;
    let leveledUp = false;
    while (this.exp >= this.expNeeded && this.level < 15) {
      this.exp -= this.expNeeded;
      this.levelUp();
      leveledUp = true;
    }
    return leveledUp;
  }

  levelUp() {
    this.level += 1;
    this.expNeeded = Math.floor(this.expNeeded * 1.35 + 80);
    this.skillPoints += 1;

    // 属性自然成长
    this.maxHp += 220;
    this.hp += 220;
    this.attack += 10;
    this.armor += 4;
    this.magicResist += 3;
    this.updateHpSprite();
  }

  gainGold(amount) {
    this.gold += amount;
  }

  buyItem(item) {
    if (this.items.length >= 6) return false;
    if (this.gold < item.cost) return false;

    this.gold -= item.cost;
    this.items.push(item);

    // 属性叠加
    if (item.attack) this.attack += item.attack;
    if (item.hp) {
      this.maxHp += item.hp;
      this.hp += item.hp;
    }
    if (item.armor) this.armor += item.armor;
    if (item.magicResist) this.magicResist += item.magicResist;
    if (item.speed) this.speed += item.speed;

    this.updateHpSprite();
    return true;
  }

  upgradeSkill(skillIndex) {
    if (this.skillPoints <= 0) return false;
    const idx = skillIndex - 1;
    if (this.skillLevels[idx] >= 5) return false;

    // 大招 4 级满 12 级满等控制
    this.skillLevels[idx] += 1;
    this.skillPoints -= 1;
    return true;
  }

  startRecall() {
    if (this.isDead || this.isRecalling) return;
    this.isRecalling = true;
    this.recallTimer = this.recallDuration;
  }

  cancelRecall() {
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallTimer = 0;
    }
  }

  takeDamage(amount, type = 'physical', attacker = null) {
    this.cancelRecall(); // 受击打断回城
    return super.takeDamage(amount, type, attacker);
  }

  takeOptimisticDamage(amount) {
    if (this.isDead) return 0;
    this.cancelRecall();
    this.hp = Math.max(1, this.hp - amount);
    this.updateHpSprite();
    this.flashHit();
    return amount;
  }

  die(killer) {
    super.die(killer);
    this.deaths += 1;
    this.respawnTimer = Math.min(25, this.respawnDuration + this.level * 1.5);
    this.cancelRecall();
    this.mesh.visible = false;
  }

  respawn() {
    this.isDead = false;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.mesh.visible = true;
    this.mesh.position.set(this.spawnPoint.x, 0, this.spawnPoint.z);
    this.updateHpSprite();
  }

  update(delta) {
    super.update(delta);

    // 技能冷却递减
    for (const k of ['s1', 's2', 's3', 'spell', 'heal']) {
      if (this.cds[k] > 0) {
        this.cds[k] = Math.max(0, this.cds[k] - delta);
      }
    }

    // 回城引导
    if (this.isRecalling) {
      this.recallTimer -= delta;
      if (this.recallTimer <= 0) {
        this.isRecalling = false;
        // 瞬间传送回泉水并回满血
        this.mesh.position.set(this.spawnPoint.x, 0, this.spawnPoint.z);
        this.heal(this.maxHp);
      }
    }

    // 复活倒计时
    if (this.isDead && this.respawnTimer > 0) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0 && !this.isRemotePeer) {
        this.respawn();
      }
    }
  }
}
