import * as THREE from '../../libs/three.module.js';

/**
 * Map - 墨家机关道 1v1 单路 3D 战场
 * 包含加长石板主道、双方宏伟基地城墙与防御塔楼、远景峡谷山体、泉水符文法阵与护栏
 * 彻底消除边界空洞与黑屏死角
 */
export class Map {
  constructor(scene) {
    this.scene = scene;
    this.bounds = {
      minX: -50,
      maxX: 50,
      minZ: -7.5,
      maxZ: 7.5
    };

    this.buildEnvironment();
  }

  buildEnvironment() {
    // 1. 单路主石板长桥面 (扩大至长 140m, 宽 18m，覆盖整个对战与出生区域)
    const bridgeGeo = new THREE.BoxGeometry(140, 2.5, 18);
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.1
    });
    const bridgeMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridgeMesh.position.set(0, -1.25, 0);
    bridgeMesh.receiveShadow = true;
    this.scene.add(bridgeMesh);

    // 2. 桥面雕花地砖纹理贴块 (从 X = -60 铺至 X = +60)
    for (let x = -60; x <= 60; x += 6) {
      const tileGeo = new THREE.PlaneGeometry(5.2, 16.8);
      tileGeo.rotateX(-Math.PI / 2);
      const isMiddle = Math.abs(x) < 3;
      const tileMat = new THREE.MeshStandardMaterial({
        color: isMiddle ? 0x334155 : ((Math.floor(x / 6) % 2 === 0) ? 0x24324a : 0x1a2436),
        roughness: 0.9
      });
      const tile = new THREE.Mesh(tileGeo, tileMat);
      tile.position.set(x, 0.01, 0);
      tile.receiveShadow = true;
      this.scene.add(tile);
    }

    // 3. 中轴分道金线与符文装饰
    const lineGeo = new THREE.PlaneGeometry(120, 0.35);
    lineGeo.rotateX(-Math.PI / 2);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.45 });
    const centerLine = new THREE.Mesh(lineGeo, lineMat);
    centerLine.position.set(0, 0.02, 0);
    this.scene.add(centerLine);

    // 4. 两侧石质机关护栏 (Z = -9 与 Z = 9)
    [-9, 9].forEach(z => {
      const railGeo = new THREE.BoxGeometry(130, 1.4, 1.0);
      const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
      const railing = new THREE.Mesh(railGeo, railMat);
      railing.position.set(0, 0.7, z);
      this.scene.add(railing);

      // 护栏立柱与常明火炬
      for (let x = -55; x <= 55; x += 10) {
        const pillarGeo = new THREE.BoxGeometry(1.4, 2.4, 1.4);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(x, 1.2, z);
        this.scene.add(pillar);

        const flameGeo = new THREE.OctahedronGeometry(0.3, 0);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(x, 2.6, z);
        this.scene.add(flame);
      }
    });

    // 5. 蓝方宏伟要塞基地 (X = -46 泉水及向后延伸城墙)
    this.createFortressBase(-46, 0x2563eb, -1);

    // 6. 红方宏伟要塞基地 (X = +46 泉水及向后延伸城墙，彻底解决红方右侧黑屏问题)
    this.createFortressBase(46, 0xdc2626, 1);

    // 7. 中路草丛装饰
    this.createBushes(-5, -7.2);
    this.createBushes(5, 7.2);

    // 8. 两侧山体峡谷与广阔岩层背景 (无论镜头怎么看，四周均有群山巨岩，不再见虚空黑屏)
    this.createCanyonMountains();

    // 9. 宏大峡谷深渊底面
    const abyssGeo = new THREE.PlaneGeometry(500, 500);
    abyssGeo.rotateX(-Math.PI / 2);
    const abyssMat = new THREE.MeshStandardMaterial({ color: 0x0a1224, roughness: 1.0 });
    const abyss = new THREE.Mesh(abyssGeo, abyssMat);
    abyss.position.y = -18;
    abyss.receiveShadow = true;
    this.scene.add(abyss);
  }

  // 构建宏伟基地城墙、光柱与泉水法阵
  createFortressBase(posX, colorHex, direction) {
    // 泉水环
    const ringGeo = new THREE.RingGeometry(3.6, 4.8, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(posX, 0.03, 0);
    this.scene.add(ring);

    // 泉水内圈符文
    const innerGeo = new THREE.CircleGeometry(3.5, 32);
    innerGeo.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(posX, 0.02, 0);
    this.scene.add(inner);

    // 基地后方城台地面 (半径 16m，覆盖后方视野)
    const platformX = posX + direction * 10;
    const platGeo = new THREE.BoxGeometry(24, 2.6, 32);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.set(platformX, -1.2, 0);
    platform.receiveShadow = true;
    this.scene.add(platform);

    // 基地正后方宏伟城墙 (高 14m, 宽 32m)
    const wallX = posX + direction * 18;
    const wallGeo = new THREE.BoxGeometry(4.0, 14, 34);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(wallX, 6.0, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);

    // 城墙顶部烽火防线与发光能量护盾
    const shieldGeo = new THREE.PlaneGeometry(32, 10);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(wallX - direction * 0.5, 6.5, 0);
    shield.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.scene.add(shield);

    // 左右两侧巨大要塞要塞石塔楼 (Z = -14 与 Z = +14)
    [-14, 14].forEach(z => {
      const towerGeo = new THREE.CylinderGeometry(2.8, 3.4, 18, 8);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(wallX, 8.0, z);
      tower.castShadow = true;
      this.scene.add(tower);

      // 塔楼顶端悬浮发光神石
      const gemGeo = new THREE.OctahedronGeometry(1.2, 0);
      const gemMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.set(wallX, 18.5, z);
      this.scene.add(gem);
    });
  }

  // 峡谷两侧与远景巨大山峦巨岩
  createCanyonMountains() {
    // 在南北两侧 (Z = -22 与 Z = +22) 生成延绵巨岩群
    [-24, 24].forEach(baseZ => {
      for (let x = -70; x <= 70; x += 14) {
        const rockGeo = new THREE.DodecahedronGeometry(8.5, 0);
        const rockMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.9,
          flatShading: true
        });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(x + (Math.random() - 0.5) * 4, 3.5, baseZ + (Math.random() - 0.5) * 5);
        rock.scale.set(1.4, 2.0, 1.4);
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.scene.add(rock);
      }
    });

    // 基地外侧终极大山峦 (X = -75 与 X = +75)
    [-76, 76].forEach(baseX => {
      for (let z = -20; z <= 20; z += 12) {
        const mountainGeo = new THREE.ConeGeometry(14, 28, 5);
        const mountainMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.9,
          flatShading: true
        });
        const mountain = new THREE.Mesh(mountainGeo, mountainMat);
        mountain.position.set(baseX, 10, z);
        this.scene.add(mountain);
      }
    });
  }

  createBushes(posX, posZ) {
    const bushGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const bGeo = new THREE.DodecahedronGeometry(0.9, 0);
      const bMat = new THREE.MeshStandardMaterial({
        color: 0x166534,
        roughness: 0.9,
        flatShading: true
      });
      const bush = new THREE.Mesh(bGeo, bMat);
      bush.position.set((i - 2) * 1.1, 0.5, (Math.random() - 0.5) * 0.6);
      bush.scale.set(1.1, 0.8, 1.1);
      bushGroup.add(bush);
    }
    bushGroup.position.set(posX, 0, posZ);
    this.scene.add(bushGroup);
  }

  clampPosition(pos) {
    pos.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, pos.x));
    pos.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, pos.z));
    return pos;
  }
}
