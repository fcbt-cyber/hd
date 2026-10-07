import * as THREE from '../../libs/three.module.js';

/**
 * Projectiles - 3D 技能弹道与特效管理系统
 */
export class Projectiles {
  constructor(scene, game = null) {
    this.scene = scene;
    this.game = game;
    this.list = [];
  }

  // 1. 普通箭矢 (后羿普攻)
  spawnArrow(startPos, target, damage, attacker) {
    const geo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 4);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    mesh.position.y = 1.3;
    this.scene.add(mesh);

    this.list.push({
      type: 'homing',
      mesh,
      target,
      speed: 26,
      damage,
      dmgType: 'physical',
      attacker,
      onHit: (t) => {
        if (this.game && !this.game.isSinglePlayer && t === this.game.opponentHero) {
          if (attacker === this.game.playerHero) {
            t.takeOptimisticDamage(damage);
            if (this.game.network) {
              this.game.network.sendGameEvent({ action: 'hero_take_damage', amount: damage, type: 'physical' });
            }
          }
          return;
        }
        t.takeDamage(damage, 'physical', attacker);
      }
    });
  }

  // 2. 魔法弹/小兵法术
  spawnMagicBullet(startPos, target, damage, attacker, color = 0xec4899) {
    const geo = new THREE.SphereGeometry(0.25, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    mesh.position.y = 1.3;
    this.scene.add(mesh);

    this.list.push({
      type: 'homing',
      mesh,
      target,
      speed: 18,
      damage,
      dmgType: 'magic',
      attacker,
      onHit: (t) => {
        if (this.game && !this.game.isSinglePlayer && t === this.game.opponentHero) {
          if (attacker === this.game.playerHero) {
            t.takeOptimisticDamage(damage);
            if (this.game.network) {
              this.game.network.sendGameEvent({ action: 'hero_take_damage', amount: damage, type: 'magic' });
            }
          }
          return;
        }
        t.takeDamage(damage, 'magic', attacker);
      }
    });
  }

  // 3. 防御塔能量光球
  spawnTowerProjectile(startPos, target, damage, attacker) {
    const color = attacker.team === 0 ? 0x60a5fa : 0xf87171;
    const geo = new THREE.SphereGeometry(0.4, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    this.list.push({
      type: 'homing',
      mesh,
      target,
      speed: 22,
      damage,
      dmgType: 'physical',
      attacker,
      onHit: (t) => {
        if (this.game && !this.game.isSinglePlayer && t === this.game.opponentHero) {
          return; // 联机对战中防御塔对对手英雄的伤害由对手自身客户端权威计算，杜绝双重扣血
        }
        t.takeDamage(damage, 'physical', attacker);
      }
    });
  }

  // 4. 妲己1技能：灵魂冲击 (直线穿透波)
  spawnDajiS1Wave(startPos, dir, damage, attacker, enemies) {
    const geo = new THREE.PlaneGeometry(1.8, 0.4);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    mesh.position.y = 1.2;
    const angle = Math.atan2(dir.x, dir.z);
    mesh.rotation.y = angle;
    this.scene.add(mesh);

    const hitSet = new Set();
    this.list.push({
      type: 'linear',
      mesh,
      dir,
      speed: 19,
      distanceLeft: 7,
      attacker,
      updateTick: () => {
        // 范围碰撞检测
        enemies.forEach(e => {
          if (!e.isDead && !hitSet.has(e)) {
            const d = mesh.position.distanceTo(e.mesh.position);
            if (d < 1.1) {
              hitSet.add(e);
              if (this.game && !this.game.isSinglePlayer && e === this.game.opponentHero) {
                if (attacker === this.game.playerHero) {
                  e.takeOptimisticDamage(damage);
                  if (this.game.network) {
                    this.game.network.sendGameEvent({ action: 'hero_take_damage', amount: damage, type: 'magic' });
                  }
                }
              } else {
                e.takeDamage(damage, 'magic', attacker);
              }
            }
          }
        });
      }
    });
  }

  // 5. 妲己2技能：爱心魅惑 (追踪眩晕)
  spawnDajiCharm(startPos, target, damage, attacker) {
    // 爱心形状
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0);
    heartShape.bezierCurveTo(-0.3, 0.4, -0.6, 0, 0, -0.6);
    heartShape.bezierCurveTo(0.6, 0, 0.3, 0.4, 0, 0);

    const geo = new THREE.ShapeGeometry(heartShape);
    geo.scale(1.2, 1.2, 1.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff69b4, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    mesh.position.y = 1.5;
    this.scene.add(mesh);

    this.list.push({
      type: 'homing',
      mesh,
      target,
      speed: 16,
      damage,
      dmgType: 'magic',
      attacker,
      onHit: (t) => {
        t.applyStun(1500); // 眩晕 1.5 秒
        if (this.game && !this.game.isSinglePlayer && t === this.game.opponentHero) {
          if (attacker === this.game.playerHero) {
            t.takeOptimisticDamage(damage);
            if (this.game.network) {
              this.game.network.sendGameEvent({ action: 'hero_take_damage', amount: damage, type: 'magic', stun: 1500 });
            }
          }
          return;
        }
        t.takeDamage(damage, 'magic', attacker);
      }
    });
  }

  // 6. 妲己3技能：狐火多段爆发 (5发连续飞弹)
  spawnDajiFoxFire(startPos, target, damage, attacker) {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (!target || target.isDead) return;
        this.spawnMagicBullet(startPos, target, damage, attacker, 0xf43f5e);
      }, i * 110);
    }
  }

  // 7. 后羿2技能：落日余晖 (天降日柱光芒打击)
  spawnHouyiSunStrike(centerPos, damage, attacker, enemies) {
    const cylinderGeo = new THREE.CylinderGeometry(1.5, 1.5, 16, 16, 1, true);
    const cylinderMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(cylinderGeo, cylinderMat);
    mesh.position.set(centerPos.x, 8, centerPos.z);
    this.scene.add(mesh);

    let life = 0.45;
    this.list.push({
      type: 'custom',
      updateTick: (delta) => {
        life -= delta;
        mesh.material.opacity = life / 0.45 * 0.6;
        if (life <= 0) {
          this.scene.remove(mesh);
          return true; // remove
        }
        return false;
      }
    });

    // 瞬间造成范围伤害与减速
    enemies.forEach(e => {
      if (!e.isDead) {
        const d = Math.hypot(e.mesh.position.x - centerPos.x, e.mesh.position.z - centerPos.z);
        if (d <= 1.6) {
          e.applySlow(2000, 0.5); // 减速 50%
          if (this.game && !this.game.isSinglePlayer && e === this.game.opponentHero) {
            if (attacker === this.game.playerHero) {
              e.takeOptimisticDamage(damage);
              if (this.game.network) {
                this.game.network.sendGameEvent({ action: 'hero_take_damage', amount: damage, type: 'physical' });
              }
            }
          } else {
            e.takeDamage(damage, 'physical', attacker);
          }
        }
      }
    });
  }

  // 8. 后羿大招：灼日之矢 (全图火焰神箭)
  spawnHouyiUlt(startPos, dir, damage, attacker, enemies, onHitCallback) {
    const arrowGroup = new THREE.Group();
    // 巨大金凤火箭
    const shaftGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.2, 6);
    shaftGeo.rotateX(Math.PI / 2);
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    arrowGroup.add(shaft);

    // 火焰翅翼
    const wingGeo = new THREE.PlaneGeometry(1.6, 1.2);
    wingGeo.rotateX(-Math.PI / 2);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    arrowGroup.add(wings);

    arrowGroup.position.copy(startPos);
    arrowGroup.position.y = 1.4;
    const angle = Math.atan2(dir.x, dir.z);
    arrowGroup.rotation.y = angle;
    this.scene.add(arrowGroup);

    let distanceTraveled = 0;
    this.list.push({
      type: 'linear',
      mesh: arrowGroup,
      dir,
      speed: 28,
      distanceLeft: 999, // 全图飞行
      attacker,
      updateTick: (delta) => {
        distanceTraveled += 28 * delta;
        // 检测是否撞击到敌方英雄
        for (const e of enemies) {
          if (!e.isDead && !e.isMinion && !e.isCrystal) {
            const d = arrowGroup.position.distanceTo(e.mesh.position);
            if (d < 1.0) {
              // 命中！眩晕时间基于飞行距离 (0.75s ~ 3.5s)
              const stunMs = Math.min(3500, Math.max(750, distanceTraveled * 35));
              e.applyStun(stunMs);
              const totalDmg = damage + Math.floor(distanceTraveled * 5);
              if (this.game && !this.game.isSinglePlayer && e === this.game.opponentHero) {
                if (attacker === this.game.playerHero) {
                  e.takeOptimisticDamage(totalDmg);
                  if (this.game.network) {
                    this.game.network.sendGameEvent({ action: 'hero_take_damage', amount: totalDmg, type: 'physical', stun: stunMs });
                  }
                }
              } else {
                e.takeDamage(totalDmg, 'physical', attacker);
              }
              if (onHitCallback) onHitCallback(e);
              return true; // 移除巨箭
            }
          }
        }
        return false;
      }
    });
  }

  // 9. 亚瑟大招砸地冲击波
  spawnArthurSlamShockwave(centerPos) {
    const ringGeo = new THREE.RingGeometry(0.25, 2.1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.position.set(centerPos.x, 0.08, centerPos.z);
    this.scene.add(mesh);

    let life = 0.5;
    this.list.push({
      type: 'custom',
      updateTick: (delta) => {
        life -= delta;
        mesh.scale.multiplyScalar(1.0 + delta * 2.5);
        mesh.material.opacity = (life / 0.5) * 0.8;
        if (life <= 0) {
          this.scene.remove(mesh);
          return true;
        }
        return false;
      }
    });
  }

  update(delta) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];

      if (p.type === 'custom') {
        const remove = p.updateTick(delta);
        if (remove) {
          this.list.splice(i, 1);
        }
        continue;
      }

      if (p.type === 'homing') {
        if (!p.target || p.target.isDead) {
          this.scene.remove(p.mesh);
          this.list.splice(i, 1);
          continue;
        }

        const targetPos = p.target.mesh.position.clone();
        targetPos.y += 1.2;
        const dx = targetPos.x - p.mesh.position.x;
        const dy = targetPos.y - p.mesh.position.y;
        const dz = targetPos.z - p.mesh.position.z;
        const dist = Math.hypot(dx, dy, dz);

        const step = p.speed * delta;
        if (dist <= step) {
          // 击中
          if (p.onHit) p.onHit(p.target);
          this.scene.remove(p.mesh);
          this.list.splice(i, 1);
        } else {
          p.mesh.position.x += (dx / dist) * step;
          p.mesh.position.y += (dy / dist) * step;
          p.mesh.position.z += (dz / dist) * step;
        }
      } else if (p.type === 'linear') {
        const step = p.speed * delta;
        p.mesh.position.x += p.dir.x * step;
        p.mesh.position.z += p.dir.z * step;
        p.distanceLeft -= step;

        let shouldRemove = false;
        if (p.updateTick) {
          shouldRemove = p.updateTick(delta);
        }

        if (p.distanceLeft <= 0 || shouldRemove || Math.abs(p.mesh.position.x) > 65) {
          this.scene.remove(p.mesh);
          this.list.splice(i, 1);
        }
      }
    }
  }

  clear() {
    this.list.forEach(p => {
      if (p.mesh) this.scene.remove(p.mesh);
    });
    this.list = [];
  }
}
