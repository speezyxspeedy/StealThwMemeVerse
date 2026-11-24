import * as THREE from 'three';
import {
  BASE_PLOTS,
  CONVEYOR_END_Z,
  CONVEYOR_HEIGHT,
  CONVEYOR_LANE_X,
  CONVEYOR_START_Z,
  LANDMARKS,
  OBBY_PLATFORMS,
} from '../shared/worldConfig';
import {
  createBillboardLabelTexture,
  createConveyorBeltTexture,
  createGrassTexture,
  createPlazaTileTexture,
} from './proceduralTextures';

export interface BaseVisualHandle {
  index: number;
  plinthMat: THREE.MeshStandardMaterial;
  trimMat: THREE.MeshStandardMaterial;
  shieldGroup: THREE.Group;
  ownerSign: THREE.Sprite;
  pedestalGlows: THREE.MeshStandardMaterial[];
  currentOwnerKey: string;
}

export interface WorldEnvironmentHandles {
  conveyorTex: THREE.CanvasTexture;
  waterMesh: THREE.Mesh;
  clouds: THREE.Group[];
  luckyCube: THREE.Mesh;
  rebirthRings: THREE.Mesh[];
  shopGear: THREE.Mesh;
  skyChestLid: THREE.Mesh;
  bases: BaseVisualHandle[];
}

export function buildMemeverseWorld(
  scene: THREE.Scene,
  maxAnisotropy: number,
): WorldEnvironmentHandles {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // ================= 1. EXPANSIVE STYLED OCEAN & ARCHIPELAGO ISLAND =================
  const waterGeo = new THREE.PlaneGeometry(520, 520, 48, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.24,
    metalness: 0.35,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = -2.6;
  waterMesh.receiveShadow = true;
  worldGroup.add(waterMesh);

  // Main outer lush meadow island (natural beveled octagon-cylinder)
  const grassTex = createGrassTexture(maxAnisotropy);
  const islandTop = new THREE.Mesh(
    new THREE.CylinderGeometry(68, 72, 2.8, 32),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.85, metalness: 0.02 }),
  );
  islandTop.position.y = -1.42;
  islandTop.receiveShadow = true;
  worldGroup.add(islandTop);

  // Cliff bedrock rim underneath
  const cliffRim = new THREE.Mesh(
    new THREE.CylinderGeometry(71.5, 62, 6, 24),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92, metalness: 0.05 }),
  );
  cliffRim.position.y = -5.6;
  worldGroup.add(cliffRim);

  // Central stone marketplace plaza (offset Y >= 0.03 above grass so zero Z-fighting)
  const plazaTex = createPlazaTileTexture(maxAnisotropy);
  const plazaFloor = new THREE.Mesh(
    new THREE.BoxGeometry(38, 0.14, 74),
    new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.62, metalness: 0.08 }),
  );
  plazaFloor.position.set(0, -0.02, 0);
  plazaFloor.receiveShadow = true;
  worldGroup.add(plazaFloor);

  // Decorative plaza border curbs
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.35 });
  for (const x of [-19.2, 19.2]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 74.6), curbMat);
    curb.position.set(x, 0.06, 0);
    curb.receiveShadow = true;
    worldGroup.add(curb);
  }

  // Distant decorative floating islands around the horizon
  const distantIslandMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.85 });
  const distantRockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.92 });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.3;
    const dist = 105 + (i % 3) * 24;
    const g = new THREE.Group();
    g.position.set(Math.cos(ang) * dist, -1 + (i % 3) * 4, Math.sin(ang) * dist);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(11 + (i % 4) * 3, 13, 3, 10), distantIslandMat);
    const bot = new THREE.Mesh(new THREE.ConeGeometry(12 + (i % 3) * 2, 14, 9), distantRockMat);
    bot.rotation.x = Math.PI;
    bot.position.y = -8;
    g.add(top, bot);
    worldGroup.add(g);
  }

  // ================= 2. INSTANCED COMPOSITE PERIMETER TREES & ROCKS =================
  const treePositions: Array<{ x: number; z: number; scale: number; tint: number }> = [];
  for (let i = 0; i < 42; i++) {
    const ang = (i / 42) * Math.PI * 2;
    const r = 52 + ((i * 19) % 12);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    // Keep Sky Obby corridor clear
    if (z < -34 && Math.abs(x) < 12) continue;
    treePositions.push({
      x,
      z,
      scale: 0.85 + ((i * 37) % 30) / 100,
      tint: i % 3 === 0 ? 0x22c55e : i % 3 === 1 ? 0x16a34a : 0x4ade80,
    });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 2.8, 8);
  trunkGeo.translate(0, 1.4, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);

  const canopy1Geo = new THREE.ConeGeometry(2.1, 3.4, 9);
  canopy1Geo.translate(0, 3.8, 0);
  const canopy2Geo = new THREE.ConeGeometry(1.5, 2.8, 9);
  canopy2Geo.translate(0, 5.5, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
  const canopy1Inst = new THREE.InstancedMesh(canopy1Geo, canopyMat, treePositions.length);
  const canopy2Inst = new THREE.InstancedMesh(canopy2Geo, canopyMat, treePositions.length);

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  treePositions.forEach((t, i) => {
    dummy.position.set(t.x, 0, t.z);
    dummy.rotation.y = i * 1.1;
    dummy.scale.setScalar(t.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    canopy1Inst.setMatrixAt(i, dummy.matrix);
    canopy2Inst.setMatrixAt(i, dummy.matrix);
    col.setHex(t.tint);
    canopy1Inst.setColorAt(i, col);
    col.offsetHSL(0, 0, 0.06);
    canopy2Inst.setColorAt(i, col);
  });
  trunkInst.castShadow = true;
  canopy1Inst.castShadow = true;
  canopy2Inst.castShadow = true;
  trunkInst.computeBoundingSphere();
  canopy1Inst.computeBoundingSphere();
  canopy2Inst.computeBoundingSphere();
  worldGroup.add(trunkInst, canopy1Inst, canopy2Inst);

  // Drifting low-poly clouds
  const clouds: THREE.Group[] = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9, metalness: 0.0 });
  const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 10; i++) {
    const cg = new THREE.Group();
    const parts = 3 + (i % 3);
    for (let p = 0; p < parts; p++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.scale.set(2.4 + (p % 2), 1.4 + (p % 2) * 0.4, 2.0);
      puff.position.set((p - 1.2) * 2.1, (p % 2) * 0.5, (p % 2) * 0.6);
      cg.add(puff);
    }
    cg.position.set(-70 + i * 16, 26 + (i % 4) * 4, -55 + (i % 5) * 26);
    clouds.push(cg);
    worldGroup.add(cg);
  }

  // ================= 3. CENTRAL DUAL-LANE CONVEYOR BELT =================
  const conveyorTex = createConveyorBeltTexture(maxAnisotropy);
  const beltLen = CONVEYOR_END_Z - CONVEYOR_START_Z;
  const beltCenterZ = (CONVEYOR_START_Z + CONVEYOR_END_Z) / 2;

  const conveyorGroup = new THREE.Group();
  worldGroup.add(conveyorGroup);

  const metalFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.32, metalness: 0.78 });
  const neonTrimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.5,
  });

  // Twin lanes
  for (const laneX of CONVEYOR_LANE_X) {
    const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(3.4, CONVEYOR_HEIGHT - 0.08, beltLen), metalFrameMat);
    baseBlock.position.set(laneX, (CONVEYOR_HEIGHT - 0.08) / 2, beltCenterZ);
    baseBlock.castShadow = true;
    baseBlock.receiveShadow = true;
    conveyorGroup.add(baseBlock);

    const beltTop = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, beltLen),
      new THREE.MeshStandardMaterial({ map: conveyorTex, roughness: 0.48, metalness: 0.15 }),
    );
    beltTop.rotation.x = -Math.PI / 2;
    beltTop.position.set(laneX, CONVEYOR_HEIGHT + 0.01, beltCenterZ);
    beltTop.receiveShadow = true;
    conveyorGroup.add(beltTop);

    for (const side of [-1.72, 1.72]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, beltLen), neonTrimMat);
      rail.position.set(laneX + side, CONVEYOR_HEIGHT + 0.08, beltCenterZ);
      conveyorGroup.add(rail);
    }
  }

  // Conveyor intake & exit glowing factory arches
  for (const archZ of [CONVEYOR_START_Z, CONVEYOR_END_Z]) {
    const isStart = archZ === CONVEYOR_START_Z;
    const archGlow = new THREE.MeshStandardMaterial({
      color: isStart ? 0x22c55e : 0xf43f5e,
      emissive: isStart ? 0x16a34a : 0xe11d48,
      emissiveIntensity: 0.7,
      roughness: 0.25,
    });
    for (const sideX of [-4.6, 4.6]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.4, 1.1), metalFrameMat);
      pillar.position.set(sideX, 2.7, archZ);
      pillar.castShadow = true;
      conveyorGroup.add(pillar);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(10.2, 1.2, 1.3), metalFrameMat);
    header.position.set(0, 5.4, archZ);
    header.castShadow = true;
    conveyorGroup.add(header);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.25, 1.38), archGlow);
    strip.position.set(0, 4.9, archZ);
    conveyorGroup.add(strip);
  }

  // Center overhead marquee billboard
  const marqueeTex = createBillboardLabelTexture(
    'MEMELING CONVEYOR',
    'Walk close & press [E] to Buy!',
    '#38bdf8',
    'LIVE FACTORY',
  );
  const marquee = new THREE.Sprite(new THREE.SpriteMaterial({ map: marqueeTex, transparent: true }));
  marquee.scale.set(8.5, 2.6, 1);
  marquee.position.set(0, 7.2, CONVEYOR_START_Z);
  conveyorGroup.add(marquee);

  // ================= 4. EIGHT PERSONAL BASE PLOTS =================
  const bases: BaseVisualHandle[] = [];
  const laserMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const laserBeamMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.4,
    roughness: 0.1,
  });

  for (const plot of BASE_PLOTS) {
    const baseGroup = new THREE.Group();
    worldGroup.add(baseGroup);

    const plinthMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.52, metalness: 0.14 });
    const trimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(plot.accentColor),
      roughness: 0.28,
      metalness: 0.55,
    });

    // Main base floor plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.42, 11.6), plinthMat);
    plinth.position.set(plot.center.x, 0.21, plot.center.z);
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    baseGroup.add(plinth);

    // Accent perimeter trim frame
    const trimRing = new THREE.Mesh(new THREE.BoxGeometry(12.0, 0.18, 12.0), trimMat);
    trimRing.position.set(plot.center.x, 0.1, plot.center.z);
    baseGroup.add(trimRing);

    // Back wall + corner columns (open front facing the plaza!)
    const dirX = plot.center.x < 0 ? 1 : -1;
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.2, 11.6), plinthMat);
    backWall.position.set(plot.center.x - dirX * 5.55, 1.8, plot.center.z);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    baseGroup.add(backWall);

    // 4 Corner pillars
    for (const sx of [-5.5, 5.5]) {
      for (const sz of [-5.5, 5.5]) {
        const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 4.2, 10), trimMat);
        colMesh.position.set(plot.center.x + sx, 2.3, plot.center.z + sz);
        colMesh.castShadow = true;
        baseGroup.add(colMesh);
      }
    }

    // Front entry archway beam
    const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 11.6), trimMat);
    frontBeam.position.set(plot.center.x + dirX * 5.5, 4.4, plot.center.z);
    frontBeam.castShadow = true;
    baseGroup.add(frontBeam);

    // 12 Display Pedestals
    const pedestalGlows: THREE.MeshStandardMaterial[] = [];
    for (const pedPos of plot.pedestals) {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.96, 0.26, 12), metalFrameMat);
      ped.position.set(pedPos.x, 0.44, pedPos.z);
      ped.receiveShadow = true;
      baseGroup.add(ped);

      const glowMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.25,
        roughness: 0.3,
      });
      pedestalGlows.push(glowMat);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 12), glowMat);
      disc.position.set(pedPos.x, 0.58, pedPos.z);
      baseGroup.add(disc);
    }

    // Deposit Pad (glowing green heist drop-off mat!)
    const depPad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.55, 0.14, 18),
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x16a34a,
        emissiveIntensity: 0.55,
        roughness: 0.25,
      }),
    );
    depPad.position.set(plot.depositPad.x, 0.14, plot.depositPad.z);
    baseGroup.add(depPad);

    // Interactive Lock Shield Terminal Pillar
    const lockPost = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.7), metalFrameMat);
    lockPost.position.set(plot.lockTerminal.x, 0.75, plot.lockTerminal.z);
    lockPost.castShadow = true;
    baseGroup.add(lockPost);

    const lockBtn = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.8,
        roughness: 0.15,
      }),
    );
    lockBtn.position.set(plot.lockTerminal.x, 1.72, plot.lockTerminal.z);
    baseGroup.add(lockBtn);

    // Physical Translucent Laser Shield Enclosure (toggled visible when locked!)
    const shieldGroup = new THREE.Group();
    shieldGroup.position.set(plot.center.x, 2.35, plot.center.z);
    const shieldWall = new THREE.Mesh(new THREE.BoxGeometry(11.4, 4.3, 11.4), laserMat);
    shieldWall.renderOrder = 5;
    shieldGroup.add(shieldWall);

    // Horizontal glowing laser bars across the front opening
    for (let b = 0; b < 4; b++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 11.0, 8), laserBeamMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(dirX * 5.65, -1.5 + b * 1.0, 0);
      shieldGroup.add(bar);
    }
    shieldGroup.visible = false;
    baseGroup.add(shieldGroup);

    // Owner Overhead Signboard
    const signTex = createBillboardLabelTexture(
      `PLOT #${plot.index + 1}`,
      'Open Base',
      plot.accentColor,
      'AVAILABLE',
    );
    const ownerSign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex, transparent: true }));
    ownerSign.scale.set(5.4, 1.65, 1);
    ownerSign.position.set(plot.center.x + dirX * 5.2, 5.75, plot.center.z);
    baseGroup.add(ownerSign);

    bases.push({
      index: plot.index,
      plinthMat,
      trimMat,
      shieldGroup,
      ownerSign,
      pedestalGlows,
      currentOwnerKey: '',
    });
  }

  // ================= 5. WORLD LANDMARKS (SHOP, REBIRTH, LUCKY, LEADERBOARD, OBBY) =================
  // A. Upgrade Shop Pavilion
  const shopGroup = new THREE.Group();
  shopGroup.position.set(LANDMARKS.upgradeShop.x, 0, LANDMARKS.upgradeShop.z);
  const shopBase = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 4.2, 0.45, 8),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.35 }),
  );
  shopBase.position.y = 0.22;
  shopGroup.add(shopBase);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 3.8, 8), metalFrameMat);
    post.position.set(Math.cos(ang) * 2.8, 2.1, Math.sin(ang) * 2.8);
    shopGroup.add(post);
  }
  const awning = new THREE.Mesh(
    new THREE.ConeGeometry(4.4, 1.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.42 }),
  );
  awning.position.y = 4.6;
  shopGroup.add(awning);
  const shopGear = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.26, 8, 12),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 }),
  );
  shopGear.position.y = 2.6;
  shopGroup.add(shopGear);
  const shopSign = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createBillboardLabelTexture('UPGRADE SHOP', 'Press [E] for Upgrades & Skins', '#38bdf8', 'GEAR & VAULT'),
      transparent: true,
    }),
  );
  shopSign.scale.set(5.2, 1.55, 1);
  shopSign.position.set(0, 6.2, 0);
  shopGroup.add(shopSign);
  worldGroup.add(shopGroup);

  // B. Rebirth Shrine
  const rebirthGroup = new THREE.Group();
  rebirthGroup.position.set(LANDMARKS.rebirthShrine.x, 0, LANDMARKS.rebirthShrine.z);
  const dais1 = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 4.3, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.3, metalness: 0.5 }),
  );
  dais1.position.y = 0.2;
  rebirthGroup.add(dais1);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.2, 5.2, 14),
    new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  beacon.position.y = 2.8;
  rebirthGroup.add(beacon);

  const rebirthRings: THREE.Mesh[] = [];
  const goldRingMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.9,
    roughness: 0.16,
  });
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1 - i * 0.45, 0.14, 10, 28), goldRingMat);
    ring.position.y = 2.8;
    rebirthRings.push(ring);
    rebirthGroup.add(ring);
  }
  const rebirthSign = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createBillboardLabelTexture('REBIRTH SHRINE', 'Press [E] to Multiply Income', '#fbbf24', 'PRESTIGE'),
      transparent: true,
    }),
  );
  rebirthSign.scale.set(5.2, 1.55, 1);
  rebirthSign.position.set(0, 6.2, 0);
  rebirthGroup.add(rebirthSign);
  worldGroup.add(rebirthGroup);

  // C. Lucky Block Zone
  const luckyGroup = new THREE.Group();
  luckyGroup.position.set(LANDMARKS.luckyBlockZone.x, 0, LANDMARKS.luckyBlockZone.z);
  const luckyPad = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 4.0, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.35, metalness: 0.45 }),
  );
  luckyPad.position.y = 0.2;
  luckyGroup.add(luckyPad);

  const luckyCube = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 2.1, 2.1),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
      metalness: 0.72,
      roughness: 0.22,
    }),
  );
  luckyCube.position.y = 2.5;
  luckyCube.castShadow = true;
  luckyGroup.add(luckyCube);

  const luckySign = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createBillboardLabelTexture('LUCKY BLOCKS', 'Press [E] to Unbox Rare Memelings', '#c084fc', 'MYSTERY LOOT'),
      transparent: true,
    }),
  );
  luckySign.scale.set(5.4, 1.6, 1);
  luckySign.position.set(0, 5.4, 0);
  luckyGroup.add(luckySign);
  worldGroup.add(luckyGroup);

  // D. Leaderboard Monument
  const lbGroup = new THREE.Group();
  lbGroup.position.set(LANDMARKS.leaderboardMonument.x, 0, LANDMARKS.leaderboardMonument.z);
  const lbBase = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.6, 3.2), metalFrameMat);
  lbBase.position.y = 0.3;
  const lbPillar = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 4.8, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.55 }),
  );
  lbPillar.position.y = 2.8;
  lbPillar.castShadow = true;
  const lbTrophy = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), goldRingMat);
  lbTrophy.position.y = 6.3;
  const lbSign = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createBillboardLabelTexture('HALL OF TYCOONS', 'Top Empires in the Memeverse', '#fbbf24', 'LEADERBOARD'),
      transparent: true,
    }),
  );
  lbSign.scale.set(5.2, 1.55, 1);
  lbSign.position.set(0, 7.8, 0);
  lbGroup.add(lbBase, lbPillar, lbTrophy, lbSign);
  worldGroup.add(lbGroup);

  // E. Trading Plaza Arch
  const trGroup = new THREE.Group();
  trGroup.position.set(LANDMARKS.tradingPlaza.x, 0, LANDMARKS.tradingPlaza.z);
  for (const sx of [-2.1, 2.1]) {
    const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 4.4, 10), metalFrameMat);
    colMesh.position.set(sx, 2.2, 0);
    trGroup.add(colMesh);
  }
  const trBeam = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.65, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.45, roughness: 0.25 }),
  );
  trBeam.position.y = 4.5;
  const trSign = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createBillboardLabelTexture('TRADING PLAZA', 'Press [E] to Trade & Chat', '#4ade80', 'SAFE SWAP'),
      transparent: true,
    }),
  );
  trSign.scale.set(5.0, 1.5, 1);
  trSign.position.set(0, 6.1, 0);
  trGroup.add(trBeam, trSign);
  worldGroup.add(trGroup);

  // F. Sky Obby Platforms + Hidden Sky Treasure Chest
  for (const plat of OBBY_PLATFORMS) {
    const pMesh = new THREE.Mesh(
      new THREE.BoxGeometry(plat.rx * 2, 0.48, plat.rz * 2),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(plat.color),
        roughness: 0.35,
        metalness: 0.28,
      }),
    );
    pMesh.position.set(plat.x, plat.y - 0.24, plat.z);
    pMesh.castShadow = true;
    pMesh.receiveShadow = true;
    worldGroup.add(pMesh);
  }

  const chestGroup = new THREE.Group();
  chestGroup.position.set(LANDMARKS.skyChest.x, LANDMARKS.skyChest.y - 0.4, LANDMARKS.skyChest.z);
  const chestBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.0, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5, metalness: 0.2 }),
  );
  chestBox.position.y = 0.5;
  const skyChestLid = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.36, 1.26), goldRingMat);
  skyChestLid.position.y = 1.15;
  const chestSign = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createBillboardLabelTexture('SKY TREASURE', 'Press [E] for Free Gems & Coins!', '#fde047', 'OBBY REWARD'),
      transparent: true,
    }),
  );
  chestSign.scale.set(4.6, 1.4, 1);
  chestSign.position.set(0, 2.55, 0);
  chestGroup.add(chestBox, skyChestLid, chestSign);
  worldGroup.add(chestGroup);

  return {
    conveyorTex,
    waterMesh,
    clouds,
    luckyCube,
    rebirthRings,
    shopGear,
    skyChestLid,
    bases,
  };
}
