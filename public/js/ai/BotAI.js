/**
 * BotAI - 智能电脑对战决策引擎
 * 模拟真实玩家进行兵线对线、连招释放、防塔撤退、回城补血与装备购买
 */
export class BotAI {
  constructor(hero, enemyHero, friendlyTower, enemyTower, friendlyCrystal) {
    this.hero = hero;
    this.enemyHero = enemyHero;
    this.friendlyTower = friendlyTower;
    this.enemyTower = enemyTower;
    this.friendlyCrystal = friendlyCrystal;

    this.decisionTimer = 0;
    this.currentAction = 'idle'; // idle | push | attack_hero | retreat | recall
    this.comboStep = 0;
  }

  update(delta, minions, projectiles, soundManager) {
    if (this.hero.isDead || this.hero.isStunned()) return;

    this.decisionTimer += delta;
    if (this.decisionTimer > 0.15) { // 每 150ms 进行一次战术决策
      this.decisionTimer = 0;
      this.evaluateTactics(minions);
      this.autoShopAndLevel();
    }

    this.executeAction(delta, minions, projectiles, soundManager);
  }

  evaluateTactics(minions) {
    const hpPct = this.hero.hp / this.hero.maxHp;
    const distToEnemy = this.hero.mesh.position.distanceTo(this.enemyHero.mesh.position);
    const distToEnemyTower = this.enemyTower && !this.enemyTower.isDead ?
      this.hero.mesh.position.distanceTo(this.enemyTower.mesh.position) : 999;

    // 1. 生命值极低 (< 20%) -> 紧急撤退回泉水
    if (hpPct < 0.22) {
      this.currentAction = 'retreat';
      return;
    }

    // 2. 严防无兵线抗塔：若距离敌方防御塔很近且周围没有友方小兵，立即撤出防御塔射程
    const friendlyMinionsNearTower = minions.filter(m => m.team === this.hero.team && !m.isDead &&
      this.enemyTower && this.enemyTower.mesh.position.distanceTo(m.mesh.position) < 12
    );
    if (distToEnemyTower < 11.5 && friendlyMinionsNearTower.length === 0) {
      this.currentAction = 'retreat';
      return;
    }

    // 3. 进攻敌方英雄 (敌人在攻击射程附近且非无兵线越塔)
    if (!this.enemyHero.isDead && distToEnemy < 12.0) {
      this.currentAction = 'attack_hero';
      return;
    }

    // 4. 常规推线清理小兵
    this.currentAction = 'push';
  }

  executeAction(delta, minions, projectiles, soundManager) {
    const heroPos = this.hero.mesh.position;
    const enemyPos = this.enemyHero.mesh.position;

    // === 撤退模式 ===
    if (this.currentAction === 'retreat') {
      const fountainX = this.hero.team === 0 ? -45 : 45;
      const dx = fountainX - heroPos.x;
      const dz = 0 - heroPos.z;
      const len = Math.hypot(dx, dz) || 1;
      heroPos.x += (dx / len) * this.hero.speed * delta;
      heroPos.z += (dz / len) * this.hero.speed * delta;
      this.hero.mesh.rotation.y = Math.atan2(dx, dz);

      // 若已回到泉水附近安全区且血量未满，引导回血
      if (Math.abs(heroPos.x - fountainX) < 3.0) {
        this.hero.heal(this.hero.maxHp * 0.15 * delta);
      }
      return;
    }

    // === 英雄单挑战斗模式 ===
    if (this.currentAction === 'attack_hero') {
      const dx = enemyPos.x - heroPos.x;
      const dz = enemyPos.z - heroPos.z;
      const dist = Math.hypot(dx, dz) || 1;
      this.hero.mesh.rotation.y = Math.atan2(dx, dz);

      // 英雄专精技能连招
      if (this.hero.heroType === 'arthur') {
        // 亚瑟连招：1技能冲锋贴脸 -> 2技能开转 -> 3技能大招斩杀
        if (this.hero.cds.s1 === 0) {
          this.hero.castSkill1();
          if (soundManager) soundManager.playArthurSkill1();
        }
        if (dist < 2.0 && this.hero.cds.s2 === 0) {
          this.hero.castSkill2();
          if (soundManager) soundManager.playArthurSkill2();
        }
        if (dist < 3.5 && this.enemyHero.hp / this.enemyHero.maxHp < 0.45 && this.hero.cds.s3 === 0) {
          this.hero.castSkill3(enemyPos);
          if (soundManager) soundManager.playArthurSkill3();
          projectiles.spawnArthurSlamShockwave(enemyPos);
          this.enemyHero.applyStun(800);
          this.enemyHero.takeDamage(550, 'physical', this.hero);
        }

        // 走位：贴近敌人进行近战普攻
        if (dist > this.hero.attackRange) {
          heroPos.x += (dx / dist) * this.hero.speed * delta;
          heroPos.z += (dz / dist) * this.hero.speed * delta;
        } else {
          this.tryBasicAttack(this.enemyHero, projectiles, soundManager);
        }
      } else if (this.hero.heroType === 'daji') {
        // 妲己连招：2技能魅惑控住 -> 3技能狐火连打 -> 1技能冲击波扫射
        if (dist < 4.5 && this.hero.cds.s2 === 0) {
          this.hero.castSkill2();
          if (soundManager) soundManager.playDajiCharm();
          projectiles.spawnDajiCharm(heroPos, this.enemyHero, 280, this.hero);
        }
        if (dist < 4.25 && this.hero.cds.s3 === 0) {
          this.hero.castSkill3();
          if (soundManager) soundManager.playMagicCast();
          projectiles.spawnDajiFoxFire(heroPos, this.enemyHero, 220, this.hero);
        }
        if (dist < 6.0 && this.hero.cds.s1 === 0) {
          this.hero.castSkill1();
          if (soundManager) soundManager.playMagicCast();
          projectiles.spawnDajiS1Wave(heroPos, { x: dx / dist, z: dz / dist }, 420, this.hero, [this.enemyHero]);
        }

        // 远程拉扯风筝：保持在 4~6 米距离
        if (dist < 3.5) {
          // 太近了后退
          heroPos.x -= (dx / dist) * this.hero.speed * delta;
          heroPos.z -= (dz / dist) * this.hero.speed * delta;
        } else if (dist > 5.5) {
          // 靠近
          heroPos.x += (dx / dist) * this.hero.speed * delta;
          heroPos.z += (dz / dist) * this.hero.speed * delta;
        }
        this.tryBasicAttack(this.enemyHero, projectiles, soundManager);
      } else if (this.hero.heroType === 'houyi') {
        // 后羿连招：开1技能强化 -> 2技能落日减速 -> 远程普攻狂射
        if (this.hero.cds.s1 === 0) {
          this.hero.castSkill1();
        }
        if (dist < 5.5 && this.hero.cds.s2 === 0) {
          this.hero.castSkill2();
          projectiles.spawnHouyiSunStrike(enemyPos, 350, this.hero, [this.enemyHero]);
        }
        if (dist > 6.0 && this.hero.cds.s3 === 0) {
          this.hero.castSkill3();
          if (soundManager) soundManager.playHouyiUlt();
          projectiles.spawnHouyiUlt(heroPos, { x: dx / dist, z: dz / dist }, 550, this.hero, [this.enemyHero]);
        }

        // 极限射程风筝：保持在 7~9 米
        if (dist < 6.0) {
          heroPos.x -= (dx / dist) * this.hero.speed * delta;
          heroPos.z -= (dz / dist) * this.hero.speed * delta;
        } else if (dist > 9.0) {
          heroPos.x += (dx / dist) * this.hero.speed * delta;
          heroPos.z += (dz / dist) * this.hero.speed * delta;
        }
        this.tryBasicAttack(this.enemyHero, projectiles, soundManager);
      }
      return;
    }

    // === 推线/攻击小兵模式 ===
    if (this.currentAction === 'push') {
      const enemyMinions = minions.filter(m => m.team !== this.hero.team && !m.isDead);
      if (enemyMinions.length > 0) {
        // 攻击最近敌方小兵
        enemyMinions.sort((a, b) => heroPos.distanceTo(a.mesh.position) - heroPos.distanceTo(b.mesh.position));
        const targetMinion = enemyMinions[0];
        const d = heroPos.distanceTo(targetMinion.mesh.position);
        const mdx = targetMinion.mesh.position.x - heroPos.x;
        const mdz = targetMinion.mesh.position.z - heroPos.z;

        if (d > this.hero.attackRange) {
          heroPos.x += (mdx / d) * this.hero.speed * delta;
          heroPos.z += (mdz / d) * this.hero.speed * delta;
          this.hero.mesh.rotation.y = Math.atan2(mdx, mdz);
        } else {
          this.hero.mesh.rotation.y = Math.atan2(mdx, mdz);
          this.tryBasicAttack(targetMinion, projectiles, soundManager);
        }
      } else {
        // 无小兵，朝敌方防御塔推进
        const targetX = this.enemyTower && !this.enemyTower.isDead ? this.enemyTower.mesh.position.x : (this.hero.team === 0 ? 35 : -35);
        const dirX = targetX > heroPos.x ? 1 : -1;
        heroPos.x += dirX * this.hero.speed * delta;
        this.hero.mesh.rotation.y = dirX > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
  }

  tryBasicAttack(target, projectiles, soundManager) {
    const now = Date.now() / 1000;
    if (now - this.hero.lastAttackTime < this.hero.attackCooldown) return;
    this.hero.lastAttackTime = now;

    if (this.hero.heroType === 'arthur') {
      if (soundManager) soundManager.playAttackSlash();
      let dmg = this.hero.attack;
      if (this.hero.s1Empowered) {
        dmg = Math.round(dmg * 2.2);
        this.hero.s1Empowered = false;
        target.applySilence(1000); // 沉默 1 秒
      }
      target.takeDamage(dmg, 'physical', this.hero);
    } else if (this.hero.heroType === 'daji') {
      if (soundManager) soundManager.playMagicCast();
      projectiles.spawnMagicBullet(this.hero.mesh.position, target, this.hero.attack, this.hero);
    } else if (this.hero.heroType === 'houyi') {
      if (soundManager) soundManager.playBowShoot();
      this.hero.onBasicAttackSuccess();
      projectiles.spawnArrow(this.hero.mesh.position, target, this.hero.attack, this.hero);
    }
  }

  autoShopAndLevel() {
    // 自动技能加点
    if (this.hero.skillPoints > 0) {
      if (this.hero.skillLevels[0] < 3) this.hero.upgradeSkill(1);
      else if (this.hero.skillLevels[1] < 3) this.hero.upgradeSkill(2);
      else this.hero.upgradeSkill(3);
    }

    // 自动购买核心装备
    const buildOrder = [
      { id: 'boots', cost: 710, speed: 1.2, magicResist: 35 },
      { id: 'axe', cost: 2090, attack: 85, hp: 500 },
      { id: 'armor', cost: 2180, hp: 1200, armor: 90 }
    ];
    for (const item of buildOrder) {
      const already = this.hero.items.some(i => i.id === item.id);
      if (!already && this.hero.gold >= item.cost) {
        this.hero.buyItem(item);
        break;
      }
    }
  }
}
