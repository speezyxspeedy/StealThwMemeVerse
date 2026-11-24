import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CREATURE_BY_ID,
  formatNumber,
  getCreatureEffectiveIncome,
  MUTATION_META,
  RARITY_META,
} from '../shared/creatures';
import type { PlayerState } from '../shared/types';
import {
  BASE_PLOTS,
  COSMETIC_CATALOG,
  getConveyorWorldPosition,
  LANDMARKS,
  OBBY_PLATFORMS,
  WORLD_RADIUS,
} from '../shared/worldConfig';
import { type InteractionPrompt, useGameStore } from '../store/gameStore';
import {
  type AnimatedCreatureRig,
  createMemelingMesh,
  createPlayerAvatarMesh,
  type PlayerAvatarRig,
} from './creatureModels';
import { createBillboardLabelTexture, createContactShadowTexture } from './proceduralTextures';
import { soundEngine } from './soundEngine';
import { buildMemeverseWorld } from './worldBuilder';

export interface MobileInputState {
  moveX: number; // -1..1
  moveZ: number; // -1..1 (forward negative)
  jumpPressed: boolean;
  sprint: boolean;
}

interface ViewportProps {
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  onTriggerInteractRef: React.MutableRefObject<(() => void) | null>;
}

interface ParticleSlot {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

const _camDesired = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _tmpColor = new THREE.Color();

export const MemeverseViewport: React.FC<ViewportProps> = ({
  mobileInputRef,
  onTriggerInteractRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection (renderer string only — never userAgent)
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const skyBaseColor = new THREE.Color(0x7dd3fc);
    scene.background = skyBaseColor.clone();
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0055);

    const camera = new THREE.PerspectiveCamera(
      58,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.2,
      360,
    );
    camera.position.set(0, 18, 36);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Studio Environment Reflections (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 4. Warm/Cool 3-Point Outdoor Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x3f6212, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.55);
    sunLight.position.set(36, 56, 28);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 150;
    const d = 52;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.52);
    rimLight.position.set(-34, 24, -36);
    scene.add(rimLight);

    // 5. Build Stylized 3D World
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const world = buildMemeverseWorld(scene, maxAniso);
    const contactShadowTex = createContactShadowTexture();
    const contactShadowGeo = new THREE.PlaneGeometry(1.7, 1.7);
    contactShadowGeo.rotateX(-Math.PI / 2);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    });

    // 6. Pooled Particle Burst System (zero per-frame allocations)
    const particleGeo = new THREE.OctahedronGeometry(0.18, 0);
    const particles: ParticleSlot[] = [];
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xfacc15,
        emissiveIntensity: 0.7,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(particleGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 });
    }

    const spawnParticleBurst = (x: number, y: number, z: number, colorHex: string, count = 12) => {
      let spawned = 0;
      for (const slot of particles) {
        if (slot.life <= 0) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 2.2 + Math.random() * 4.5;
          slot.mesh.position.set(x, y, z);
          slot.vx = Math.cos(ang) * spd;
          slot.vy = 3.2 + Math.random() * 4.5;
          slot.vz = Math.sin(ang) * spd;
          slot.life = 0.65 + Math.random() * 0.4;
          slot.maxLife = slot.life;
          const m = slot.mesh.material as THREE.MeshStandardMaterial;
          m.color.set(colorHex);
          m.emissive.set(colorHex);
          slot.mesh.scale.setScalar(1);
          slot.mesh.visible = true;
          spawned++;
          if (spawned >= count) break;
        }
      }
    };

    // Dynamic entity registries
    const avatarMap = new Map<string, { rig: PlayerAvatarRig; shadow: THREE.Mesh; tx: number; ty: number; tz: number; tyaw: number }>();
    const conveyorMap = new Map<string, { rig: AnimatedCreatureRig; label: THREE.Sprite; group: THREE.Group; lane: 0 | 1; progress: number }>();
    const pedestalCreatureMap = new Map<string, { rig: AnimatedCreatureRig; label: THREE.Sprite; group: THREE.Group }>();

    // Local Player Physics & Camera Rig
    const localPos = new THREE.Vector3(0, 0, 26);
    let localVy = 0;
    let localYaw = Math.PI;
    let onGround = true;
    let coyoteTimer = 0;
    let jumpBufferTimer = 0;

    let camYaw = 0;
    let camPitch = 0.42;
    let camDist = 11.5;
    let isPointerDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let shakeIntensity = 0;
    let lastShakeReq = 0;
    let lastTeleportSeq = 0;
    let lastOwnMemelingCount = -1;
    let heistTrailAccum = 0;

    // Keyboard Input State
    const heldKeys = new Set<string>();

    const executePromptAction = () => {
      const store = useGameStore.getState();
      if (store.screen !== 'playing' || store.activeModal !== 'none') return;
      const p = store.prompt;
      if (!p) return;

      if (p.kind === 'buy' && p.payload?.itemId) {
        store.buyConveyorItem(p.payload.itemId);
        spawnParticleBurst(localPos.x, localPos.y + 1.4, localPos.z, p.accentColor, 14);
      } else if (p.kind === 'steal' && p.payload?.targetPlayerId && p.payload?.instanceId) {
        store.stealMemeling(p.payload.targetPlayerId, p.payload.instanceId);
        spawnParticleBurst(localPos.x, localPos.y + 1.4, localPos.z, '#f43f5e', 16);
      } else if (p.kind === 'lock') {
        store.lockBase();
        spawnParticleBurst(localPos.x, localPos.y + 1.2, localPos.z, '#38bdf8', 16);
      } else if (p.kind === 'shop') {
        store.setActiveModal('shop');
      } else if (p.kind === 'rebirth') {
        store.setActiveModal('rebirth');
      } else if (p.kind === 'lucky') {
        store.setActiveModal('lucky');
      } else if (p.kind === 'trade') {
        store.setActiveModal('trade');
      } else if (p.kind === 'chest') {
        store.claimSkyChest();
        spawnParticleBurst(LANDMARKS.skyChest.x, LANDMARKS.skyChest.y + 0.6, LANDMARKS.skyChest.z, '#fde047', 22);
      }
    };

    onTriggerInteractRef.current = executePromptAction;

    const isInputFocused = () => {
      const el = document.activeElement;
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      const code = e.code;
      const store = useGameStore.getState();

      if (code === 'Escape') {
        if (store.screen === 'playing') {
          store.setActiveModal(store.activeModal === 'none' ? 'pause' : 'none');
        }
        return;
      }

      if (store.screen !== 'playing') {
        if ((code === 'Enter' || code === 'Space') && !store.joining) {
          e.preventDefault();
          store.connectAndJoin();
        }
        return;
      }

      if (store.activeModal !== 'none') return;

      heldKeys.add(code);
      if (code === 'Space') {
        e.preventDefault();
        jumpBufferTimer = 0.14;
      } else if (code === 'KeyE') {
        executePromptAction();
      } else if (code === 'KeyL') {
        store.lockBase();
      } else if (code === 'KeyB') {
        store.teleportHome();
      } else if (code === 'KeyH') {
        store.toggleHudCollapsed();
      } else if (code === 'KeyI') {
        store.setActiveModal('inventory');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
    };

    const onBlur = () => {
      heldKeys.clear();
      isPointerDragging = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.target !== renderer.domElement) return;
      isPointerDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDragging) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      camYaw -= dx * 0.0058;
      camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.0048, 0.12, 1.15);
    };

    const onPointerUp = () => {
      isPointerDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (useGameStore.getState().activeModal !== 'none') return;
      camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.008, 5.5, 22);
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onResize);

    // Ground height resolver (supports base plinths, conveyor deck, and Sky Obby platforms!)
    const resolveFloorHeight = (x: number, z: number, currentY: number): number => {
      let h = 0;

      // Check Sky Obby platforms
      for (const plat of OBBY_PLATFORMS) {
        if (Math.abs(x - plat.x) <= plat.rx + 0.35 && Math.abs(z - plat.z) <= plat.rz + 0.35) {
          if (currentY >= plat.y - 0.75) {
            h = Math.max(h, plat.y);
          }
        }
      }

      // Check Personal Base plinths
      for (const plot of BASE_PLOTS) {
        if (Math.abs(x - plot.center.x) <= 5.8 && Math.abs(z - plot.center.z) <= 5.8) {
          h = Math.max(h, 0.42);
        }
      }

      // Check Conveyor decks
      if (z >= -22.2 && z <= 22.2 && (Math.abs(x - -2.2) <= 1.75 || Math.abs(x - 2.2) <= 1.75)) {
        if (currentY >= 0.4) {
          h = Math.max(h, 1.05);
        }
      }

      return h;
    };

    // Helper to keep entity meshes synced with authoritative server snapshot
    const syncEntitiesWithStore = (nowMs: number, elapsedSec: number, dt: number) => {
      const store = useGameStore.getState();
      const players = store.players;
      const localPlayer = store.playerId ? players.find((p) => p.id === store.playerId) : undefined;

      // Trigger celebratory burst when local player gains a Memeling (e.g. heist delivery or lucky drop)
      if (localPlayer) {
        if (lastOwnMemelingCount >= 0 && localPlayer.memelings.length > lastOwnMemelingCount) {
          spawnParticleBurst(localPos.x, localPos.y + 1.5, localPos.z, '#fde047', 20);
        }
        lastOwnMemelingCount = localPlayer.memelings.length;
      }

      // 1. Sync Base Visuals (themes, owner signs, laser shields, pedestal glow)
      const ownerByBase = new Map<number, PlayerState>();
      for (const p of players) ownerByBase.set(p.baseIndex, p);

      for (const baseHandle of world.bases) {
        const owner = ownerByBase.get(baseHandle.index);
        const isLocked = Boolean(owner && owner.baseLockedUntil > nowMs);
        baseHandle.shieldGroup.visible = isLocked;

        if (owner) {
          const theme = COSMETIC_CATALOG.find((c) => c.id === owner.baseTheme);
          if (theme) {
            baseHandle.plinthMat.color.set(theme.color);
            baseHandle.trimMat.color.set(theme.accent);
          }

          const maxSlots = Math.min(12, 6 + owner.upgrades.baseSlots);
          baseHandle.pedestalGlows.forEach((mat, i) => {
            if (i < maxSlots) {
              mat.emissive.set(isLocked ? 0x22d3ee : 0x4ade80);
              mat.emissiveIntensity = 0.45;
            } else {
              mat.emissive.set(0x1e293b);
              mat.emissiveIntensity = 0.05;
            }
          });

          const lockSec = isLocked ? Math.ceil((owner.baseLockedUntil - nowMs) / 1000) : 0;
          const ownerKey = `${owner.name}|${owner.memelings.length}|${lockSec}|${owner.id === store.playerId}`;
          if (baseHandle.currentOwnerKey !== ownerKey) {
            baseHandle.currentOwnerKey = ownerKey;
            const badge = isLocked
              ? `SHIELDED ${lockSec}s`
              : owner.id === store.playerId
                ? 'YOUR BASE'
                : owner.isBot
                  ? 'RIVAL BASE (RAIDABLE!)'
                  : 'UNLOCKED BASE';
            const signTex = createBillboardLabelTexture(
              owner.name,
              `${formatNumber(owner.incomePerSec)}/s · ${owner.memelings.length}/${maxSlots}`,
              isLocked ? '#38bdf8' : owner.id === store.playerId ? '#4ade80' : '#f43f5e',
              badge,
            );
            (baseHandle.ownerSign.material as THREE.SpriteMaterial).map = signTex;
            (baseHandle.ownerSign.material as THREE.SpriteMaterial).needsUpdate = true;
          }
        } else if (baseHandle.currentOwnerKey !== 'OPEN') {
          baseHandle.currentOwnerKey = 'OPEN';
          const signTex = createBillboardLabelTexture(
            `PLOT #${baseHandle.index + 1}`,
            'Open Base',
            '#94a3b8',
            'AVAILABLE',
          );
          (baseHandle.ownerSign.material as THREE.SpriteMaterial).map = signTex;
          (baseHandle.ownerSign.material as THREE.SpriteMaterial).needsUpdate = true;
        }
      }

      // 2. Sync Conveyor Memelings
      const activeConvIds = new Set<string>();
      for (const item of store.conveyor) {
        activeConvIds.add(item.id);
        let entry = conveyorMap.get(item.id);
        const pos = getConveyorWorldPosition(item.lane, item.progress);
        if (!entry) {
          const def = CREATURE_BY_ID[item.creatureId];
          const rig = createMemelingMesh(item.creatureId, item.mutation);
          const group = new THREE.Group();
          group.add(rig.root);

          const rarityColor = def ? RARITY_META[def.rarity].color : '#cbd5e1';
          const mutPrefix = item.mutation !== 'normal' ? `${MUTATION_META[item.mutation].label} ` : '';
          const badge = `${mutPrefix}${def?.rarity ?? 'Common'}`;
          const labelTex = createBillboardLabelTexture(
            def?.name ?? 'Memeling',
            `${formatNumber(item.price)} Coins`,
            rarityColor,
            badge,
          );
          const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
          label.scale.set(2.9, 0.9, 1);
          label.position.set(0, 2.35, 0);
          group.add(label);

          group.position.set(pos.x, pos.y, pos.z);
          scene.add(group);
          entry = { rig, label, group, lane: item.lane, progress: item.progress };
          conveyorMap.set(item.id, entry);
        }

        // Smoothly interpolate forward conveyor motion at 60fps
        entry.progress = THREE.MathUtils.damp(entry.progress, item.progress, 10, dt);
        const smoothPos = getConveyorWorldPosition(item.lane, entry.progress);
        entry.group.position.set(smoothPos.x, smoothPos.y, smoothPos.z);

        // Idle bounce & accessory spin
        entry.rig.body.position.y = Math.abs(Math.sin(elapsedSec * 4.2 + entry.rig.phase)) * 0.14;
        entry.rig.body.rotation.y = Math.sin(elapsedSec * 1.8 + entry.rig.phase) * 0.25;
        for (const orb of entry.rig.orbitTargets) orb.rotation.z += dt * 2.2;
        if (entry.rig.rainbowMat) {
          entry.rig.rainbowMat.color.setHSL((elapsedSec * 0.25) % 1, 0.85, 0.58);
        }
      }

      for (const [id, entry] of conveyorMap.entries()) {
        if (!activeConvIds.has(id)) {
          scene.remove(entry.group);
          conveyorMap.delete(id);
        }
      }

      // 3. Sync Base Pedestal Memelings
      const activePedIds = new Set<string>();
      for (const p of players) {
        const plot = BASE_PLOTS[p.baseIndex];
        if (!plot) continue;
        for (const mem of p.memelings) {
          const key = `${p.id}:${mem.instanceId}:${mem.level}`;
          activePedIds.add(key);
          const ped = plot.pedestals[mem.slotIndex] ?? plot.center;
          let entry = pedestalCreatureMap.get(key);
          if (!entry) {
            const def = CREATURE_BY_ID[mem.creatureId];
            const rig = createMemelingMesh(mem.creatureId, mem.mutation);
            const group = new THREE.Group();
            group.add(rig.root);

            const inc = getCreatureEffectiveIncome(mem.creatureId, mem.mutation, mem.level);
            const rarityColor = def ? RARITY_META[def.rarity].color : '#cbd5e1';
            const mutPrefix = mem.mutation !== 'normal' ? `${MUTATION_META[mem.mutation].label} ` : '';
            const labelTex = createBillboardLabelTexture(
              `${def?.name ?? 'Memeling'}${mem.level > 1 ? ` Lv.${mem.level}` : ''}`,
              `+${formatNumber(inc)}/s`,
              rarityColor,
              `${mutPrefix}${def?.rarity ?? 'Common'}`,
            );
            const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
            label.scale.set(2.5, 0.78, 1);
            label.position.set(0, 2.25, 0);
            group.add(label);

            group.position.set(ped.x, ped.y + 0.04, ped.z);
            group.rotation.y = plot.facingYaw;
            scene.add(group);
            entry = { rig, label, group };
            pedestalCreatureMap.set(key, entry);
          }

          entry.group.position.set(ped.x, ped.y + 0.04, ped.z);
          entry.rig.body.position.y = Math.abs(Math.sin(elapsedSec * 3.4 + entry.rig.phase)) * 0.12;
          entry.rig.body.rotation.y = Math.sin(elapsedSec * 1.4 + entry.rig.phase) * 0.22;
          for (const orb of entry.rig.orbitTargets) orb.rotation.z += dt * 2.0;
          if (entry.rig.rainbowMat) {
            entry.rig.rainbowMat.color.setHSL((elapsedSec * 0.25 + entry.rig.phase) % 1, 0.85, 0.58);
          }
        }
      }

      for (const [key, entry] of pedestalCreatureMap.entries()) {
        if (!activePedIds.has(key)) {
          scene.remove(entry.group);
          pedestalCreatureMap.delete(key);
        }
      }

      // 4. Sync Player Avatars (Local + Remote Humans + Rival Bots)
      const activePlayerIds = new Set<string>();
      for (const p of players) {
        activePlayerIds.add(p.id);
        let entry = avatarMap.get(p.id);
        if (!entry) {
          const labelTex = createBillboardLabelTexture(
            p.name,
            p.rebirths > 0 ? `Rebirth ${p.rebirths}` : `Lv.${p.level}`,
            p.avatarColor,
            p.isBot ? 'RIVAL' : 'PLAYER',
          );
          const rig = createPlayerAvatarMesh(p.avatarColor, labelTex);
          rig.currentName = `${p.name}|${p.level}|${p.rebirths}`;
          rig.root.position.set(p.x, p.y, p.z);
          scene.add(rig.root);

          const shadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
          shadow.position.set(p.x, 0.04, p.z);
          scene.add(shadow);

          entry = { rig, shadow, tx: p.x, ty: p.y, tz: p.z, tyaw: p.yaw };
          avatarMap.set(p.id, entry);
        }

        // Update skin color if changed
        if (entry.rig.currentColor !== p.avatarColor) {
          entry.rig.currentColor = p.avatarColor;
          entry.rig.torsoMat.color.set(p.avatarColor);
        }

        // Sneak Cloak transparency
        const isCloaked = p.isInvisibleUntil > nowMs;
        entry.rig.root.visible = !isCloaked || p.id === store.playerId;

        // Sync overhead carried Memeling!
        const wantedCarryKey = p.carrying ? `${p.carrying.instanceId}:${p.carrying.creatureId}` : null;
        if (entry.rig.carriedId !== wantedCarryKey) {
          entry.rig.carriedId = wantedCarryKey;
          while (entry.rig.carryAnchor.children.length > 0) {
            entry.rig.carryAnchor.remove(entry.rig.carryAnchor.children[0]);
          }
          if (p.carrying) {
            const carriedRig = createMemelingMesh(p.carrying.creatureId, p.carrying.mutation);
            carriedRig.root.scale.multiplyScalar(0.72);
            entry.rig.carryAnchor.add(carriedRig.root);
          }
        }
        if (p.carrying) {
          entry.rig.carryAnchor.rotation.y += dt * 2.4;
        }

        // Position update (local driven directly, remote interpolated smoothly)
        const isLocal = p.id === store.playerId;
        if (isLocal) {
          entry.rig.root.position.copy(localPos);
          entry.rig.root.rotation.y = localYaw;
          entry.shadow.position.set(localPos.x, Math.max(0.04, resolveFloorHeight(localPos.x, localPos.z, localPos.y) + 0.03), localPos.z);
        } else {
          entry.tx = p.x;
          entry.ty = p.y;
          entry.tz = p.z;
          entry.tyaw = p.yaw;
          entry.rig.root.position.x = THREE.MathUtils.damp(entry.rig.root.position.x, entry.tx, 12, dt);
          entry.rig.root.position.y = THREE.MathUtils.damp(entry.rig.root.position.y, entry.ty, 12, dt);
          entry.rig.root.position.z = THREE.MathUtils.damp(entry.rig.root.position.z, entry.tz, 12, dt);
          entry.rig.root.rotation.y = entry.tyaw;
          entry.shadow.position.set(entry.rig.root.position.x, 0.04, entry.rig.root.position.z);
        }

        // Limb walk cycle animation
        const moving = isLocal ? _moveDir.lengthSq() > 0.01 : p.isMoving;
        const walkRate = p.isSprinting ? 13 : 9;
        const swing = moving ? Math.sin(elapsedSec * walkRate) * 0.65 : 0;
        entry.rig.leftLeg.rotation.x = swing;
        entry.rig.rightLeg.rotation.x = -swing;
        if (p.carrying) {
          // Hold arms raised while carrying stolen Memeling!
          entry.rig.leftArm.rotation.x = -Math.PI * 0.82;
          entry.rig.rightArm.rotation.x = -Math.PI * 0.82;
        } else {
          entry.rig.leftArm.rotation.x = -swing * 0.85;
          entry.rig.rightArm.rotation.x = swing * 0.85;
        }
      }

      for (const [id, entry] of avatarMap.entries()) {
        if (!activePlayerIds.has(id)) {
          scene.remove(entry.rig.root);
          scene.remove(entry.shadow);
          avatarMap.delete(id);
        }
      }
    };

    // Evaluate nearest contextual world prompt
    const updateProximityPrompt = (nowMs: number) => {
      const store = useGameStore.getState();
      if (store.screen !== 'playing' || store.activeModal !== 'none') {
        store.setPrompt(null);
        return;
      }
      const me = store.players.find((p) => p.id === store.playerId);
      if (!me) return;

      let bestPrompt: InteractionPrompt | null = null;
      let bestDist = Infinity;

      // 1. Nearest Conveyor Memeling (Buy)
      for (const item of store.conveyor) {
        const pos = getConveyorWorldPosition(item.lane, item.progress);
        const d = Math.hypot(localPos.x - pos.x, localPos.z - pos.z);
        if (d < 6.4 && d < bestDist) {
          bestDist = d;
          const def = CREATURE_BY_ID[item.creatureId];
          const rarityColor = def ? RARITY_META[def.rarity].color : '#38bdf8';
          const mutLabel = item.mutation !== 'normal' ? `${MUTATION_META[item.mutation].label} ` : '';
          bestPrompt = {
            id: `buy:${item.id}`,
            keyLabel: 'E',
            actionLabel: `Buy ${mutLabel}${def?.name ?? 'Memeling'}`,
            subtitle: `${formatNumber(item.price)} Coins · +${formatNumber(getCreatureEffectiveIncome(item.creatureId, item.mutation, 1))}/s`,
            accentColor: rarityColor,
            kind: 'buy',
            payload: { itemId: item.id },
          };
        }
      }

      // 2. Nearest Rival Base Memeling (Steal!)
      if (!me.carrying) {
        const stealRange = 5.4 + me.upgrades.stealHands * 0.5;
        for (const rival of store.players) {
          if (rival.id === me.id) continue;
          const plot = BASE_PLOTS[rival.baseIndex];
          if (!plot) continue;
          const locked = rival.baseLockedUntil > nowMs;
          for (const mem of rival.memelings) {
            const ped = plot.pedestals[mem.slotIndex] ?? plot.center;
            const d = Math.hypot(localPos.x - ped.x, localPos.z - ped.z);
            if (d < stealRange && d < bestDist) {
              bestDist = d;
              const def = CREATURE_BY_ID[mem.creatureId];
              bestPrompt = {
                id: `steal:${rival.id}:${mem.instanceId}:${locked}`,
                keyLabel: 'E',
                actionLabel: locked ? `${rival.name}'s Base Shielded` : `Steal ${def?.name ?? 'Memeling'}!`,
                subtitle: locked
                  ? `Shield expires in ${Math.ceil((rival.baseLockedUntil - nowMs) / 1000)}s`
                  : `From ${rival.name} · +${formatNumber(getCreatureEffectiveIncome(mem.creatureId, mem.mutation, mem.level))}/s`,
                accentColor: locked ? '#38bdf8' : '#f43f5e',
                kind: 'steal',
                payload: { targetPlayerId: rival.id, instanceId: mem.instanceId },
              };
            }
          }
        }
      }

      // 3. Own Base Lock Terminal
      const ownPlot = BASE_PLOTS[me.baseIndex];
      if (ownPlot) {
        const dLock = Math.hypot(localPos.x - ownPlot.lockTerminal.x, localPos.z - ownPlot.lockTerminal.z);
        if (dLock < 4.0 && dLock < bestDist) {
          bestDist = dLock;
          const lockedLeft = Math.ceil((me.baseLockedUntil - nowMs) / 1000);
          bestPrompt = {
            id: `lock:${lockedLeft > 0}`,
            keyLabel: 'E',
            actionLabel: lockedLeft > 0 ? `Laser Shield Active (${lockedLeft}s)` : 'Activate Base Laser Shield',
            subtitle: 'Blocks all thieves from entering your base',
            accentColor: '#38bdf8',
            kind: 'lock',
          };
        }
      }

      // 4. World Landmarks (Shop, Rebirth, Lucky Block, Trade, Sky Chest)
      const landmarkChecks: Array<{
        pos: { x: number; y: number; z: number };
        radius: number;
        kind: InteractionPrompt['kind'];
        title: string;
        sub: string;
        color: string;
      }> = [
        { pos: LANDMARKS.upgradeShop, radius: 5.5, kind: 'shop', title: 'Open Upgrade & Skin Shop', sub: 'Expand pedestals, speed boots & vault themes', color: '#38bdf8' },
        { pos: LANDMARKS.rebirthShrine, radius: 5.5, kind: 'rebirth', title: 'Enter Rebirth Shrine', sub: 'Multiply your permanent income & earn Gems', color: '#fbbf24' },
        { pos: LANDMARKS.luckyBlockZone, radius: 5.5, kind: 'lucky', title: 'Open Lucky Blocks', sub: 'Unbox Rare, Mythic & Celestial Memelings', color: '#c084fc' },
        { pos: LANDMARKS.tradingPlaza, radius: 5.5, kind: 'trade', title: 'Open Trading & Chat Plaza', sub: 'Trade Memelings securely with other players', color: '#4ade80' },
        { pos: LANDMARKS.skyChest, radius: 4.5, kind: 'chest', title: 'Claim Sky Treasure Chest!', sub: 'Bonus Gems & Coins for completing the Sky Obby', color: '#fde047' },
      ];

      for (const lm of landmarkChecks) {
        const d = Math.hypot(localPos.x - lm.pos.x, localPos.y - lm.pos.y, localPos.z - lm.pos.z);
        if (d < lm.radius && d < bestDist) {
          bestDist = d;
          bestPrompt = {
            id: `lm:${lm.kind}`,
            keyLabel: 'E',
            actionLabel: lm.title,
            subtitle: lm.sub,
            accentColor: lm.color,
            kind: lm.kind,
          };
        }
      }

      store.setPrompt(bestPrompt);
    };

    // Pre-warm shaders on real GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 7. Main 60fps Loop (rAF on GPU, afterDraw(tick) paced on software WebGL)
    let disposed = false;
    let frameId = 0;
    let prevTime = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const nowPerf = performance.now();
      const dt = Math.min((nowPerf - prevTime) / 1000, 0.05);
      prevTime = nowPerf;
      elapsed += dt;

      const store = useGameStore.getState();
      const serverNow = Date.now() + store.serverTimeOffset;

      // Handle teleport requests from server/join/home button
      if (store.teleportRequest && store.teleportRequest.seq !== lastTeleportSeq) {
        lastTeleportSeq = store.teleportRequest.seq;
        localPos.set(store.teleportRequest.x, 0.1, store.teleportRequest.z);
        localVy = 0;
        spawnParticleBurst(localPos.x, 1.2, localPos.z, '#38bdf8', 16);
      }

      // Handle screen shake requests
      if (store.cameraShakeRequest !== lastShakeReq) {
        lastShakeReq = store.cameraShakeRequest;
        shakeIntensity = Math.min(1.0, shakeIntensity + 0.55);
      }
      shakeIntensity = Math.max(0, shakeIntensity - dt * 1.9);

      // Animate world props (conveyor belt scroll, ocean bob, clouds, landmarks)
      world.conveyorTex.offset.y -= dt * 0.55;
      world.waterMesh.position.y = -2.6 + Math.sin(elapsed * 1.1) * 0.18;
      world.luckyCube.rotation.y += dt * 0.9;
      world.luckyCube.rotation.x = Math.sin(elapsed * 1.3) * 0.28;
      world.luckyCube.position.y = 2.55 + Math.sin(elapsed * 2.2) * 0.25;
      world.rebirthRings[0].rotation.y += dt * 0.8;
      world.rebirthRings[0].rotation.x = Math.sin(elapsed * 0.9) * 0.5;
      world.rebirthRings[1].rotation.x += dt * 1.1;
      world.rebirthRings[1].rotation.z += dt * 0.7;
      world.shopGear.rotation.z += dt * 1.2;
      world.skyChestLid.position.y = 1.15 + Math.sin(elapsed * 3) * 0.04;

      for (const cloud of world.clouds) {
        cloud.position.x += dt * 0.65;
        if (cloud.position.x > 95) cloud.position.x = -95;
      }

      // Dynamic World Event sky/atmosphere mood shift
      if (store.activeEvent) {
        _tmpColor.set(store.activeEvent.accentHex).lerp(skyBaseColor, 0.58);
      } else {
        _tmpColor.copy(skyBaseColor);
      }
      (scene.background as THREE.Color).lerp(_tmpColor, Math.min(1, dt * 2));
      (scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color);

      // Update local player physics when playing
      const me = store.playerId ? store.players.find((p) => p.id === store.playerId) : undefined;
      if (store.screen === 'playing' && me) {
        const modalOpen = store.activeModal !== 'none';
        _moveDir.set(0, 0, 0);

        if (!modalOpen) {
          const fwd =
            (heldKeys.has('KeyW') || heldKeys.has('ArrowUp') ? 1 : 0) -
            (heldKeys.has('KeyS') || heldKeys.has('ArrowDown') ? 1 : 0) -
            mobileInputRef.current.moveZ;
          const right =
            (heldKeys.has('KeyD') || heldKeys.has('ArrowRight') ? 1 : 0) -
            (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft') ? 1 : 0) +
            mobileInputRef.current.moveX;

          if (heldKeys.has('KeyQ')) camYaw += dt * 1.8;

          const sinY = Math.sin(camYaw);
          const cosY = Math.cos(camYaw);
          _moveDir.set(-sinY * fwd + cosY * right, 0, -cosY * fwd - sinY * right);
          if (_moveDir.lengthSq() > 1) _moveDir.normalize();

          if (mobileInputRef.current.jumpPressed) {
            jumpBufferTimer = 0.14;
            mobileInputRef.current.jumpPressed = false;
          }
        }

        const isSprinting =
          (heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight') || mobileInputRef.current.sprint) &&
          _moveDir.lengthSq() > 0.01;
        let moveSpeed = (isSprinting ? 14.5 : 10.4) * (1 + me.upgrades.speedBoots * 0.1);

        // Carrying a stolen Memeling slows you slightly (mitigated by Sticky Gloves!)
        if (me.carrying) {
          const carryPenalty = Math.max(0.68, 0.72 + me.upgrades.stealHands * 0.06);
          moveSpeed *= carryPenalty;
          heistTrailAccum += dt;
          if (heistTrailAccum > 0.16) {
            heistTrailAccum = 0;
            spawnParticleBurst(localPos.x, localPos.y + 1.8, localPos.z, '#fbbf24', 2);
          }
        }

        // Security turret slow-field inside rival bases
        for (const rival of store.players) {
          if (rival.id === me.id || rival.upgrades.securityTurret <= 0) continue;
          const rPlot = BASE_PLOTS[rival.baseIndex];
          if (
            Math.abs(localPos.x - rPlot.center.x) < 6 &&
            Math.abs(localPos.z - rPlot.center.z) < 6
          ) {
            moveSpeed *= Math.max(0.55, 1 - rival.upgrades.securityTurret * 0.15);
          }
        }

        const nextX = localPos.x + _moveDir.x * moveSpeed * dt;
        const nextZ = localPos.z + _moveDir.z * moveSpeed * dt;

        // Client-side smooth collision against LOCKED rival base shields (server also enforces!)
        let blocked = false;
        for (const rival of store.players) {
          if (rival.id === me.id || rival.baseLockedUntil <= serverNow) continue;
          const plot = BASE_PLOTS[rival.baseIndex];
          if (Math.abs(nextX - plot.center.x) < 6.4 && Math.abs(nextZ - plot.center.z) < 6.4) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          localPos.x = THREE.MathUtils.clamp(nextX, -WORLD_RADIUS, WORLD_RADIUS);
          localPos.z = THREE.MathUtils.clamp(nextZ, -WORLD_RADIUS, WORLD_RADIUS);
        }

        if (_moveDir.lengthSq() > 0.01) {
          const targetYaw = Math.atan2(_moveDir.x, _moveDir.z);
          let diff = targetYaw - localYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          localYaw += diff * Math.min(1, dt * 12);
        }

        // Jump + Gravity + Coyote Time + Jump Buffer
        coyoteTimer = onGround ? 0.12 : Math.max(0, coyoteTimer - dt);
        jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);

        if (jumpBufferTimer > 0 && coyoteTimer > 0) {
          localVy = 11.4;
          onGround = false;
          coyoteTimer = 0;
          jumpBufferTimer = 0;
          soundEngine.playJump();
        }

        localVy -= 28 * dt;
        localPos.y += localVy * dt;

        const floorY = resolveFloorHeight(localPos.x, localPos.z, localPos.y);
        if (localPos.y <= floorY) {
          localPos.y = floorY;
          localVy = 0;
          onGround = true;
        } else {
          onGround = false;
        }

        // Send movement to authoritative server (throttled to 20Hz inside store)
        store.sendMove(localPos.x, localPos.y, localPos.z, localYaw, _moveDir.lengthSq() > 0.01, isSprinting);

        // Smooth Third-Person Orbit Camera with exponential damping & sprint FOV punch
        const targetFov = isSprinting ? 64 : 58;
        if (Math.abs(camera.fov - targetFov) > 0.1) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
          camera.updateProjectionMatrix();
        }

        const horizDist = Math.cos(camPitch) * camDist;
        const vertDist = Math.sin(camPitch) * camDist;
        _camDesired.set(
          localPos.x + Math.sin(camYaw) * horizDist,
          localPos.y + 2.2 + vertDist,
          localPos.z + Math.cos(camYaw) * horizDist,
        );

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesired.x, 11, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesired.y, 11, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesired.z, 11, dt);

        if (shakeIntensity > 0.01) {
          camera.position.x += (Math.random() - 0.5) * shakeIntensity * 0.8;
          camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.6;
        }

        _lookTarget.set(localPos.x, localPos.y + 1.65, localPos.z);
        camera.lookAt(_lookTarget);
      } else {
        // Atmospheric Title Screen orbiting showcase camera over the live Memeverse Plaza!
        const angle = elapsed * 0.18;
        camera.position.set(Math.sin(angle) * 34, 17 + Math.sin(elapsed * 0.35) * 2.5, Math.cos(angle) * 34);
        camera.lookAt(0, 2.2, 0);
      }

      // Sync 3D actors & conveyor creatures with server state
      syncEntitiesWithStore(serverNow, elapsed, dt);
      updateProximityPrompt(serverNow);

      // Update pooled particles
      for (const slot of particles) {
        if (slot.life > 0) {
          slot.life -= dt;
          slot.vy -= 12 * dt;
          slot.mesh.position.x += slot.vx * dt;
          slot.mesh.position.y += slot.vy * dt;
          slot.mesh.position.z += slot.vz * dt;
          slot.mesh.rotation.x += dt * 5;
          slot.mesh.rotation.y += dt * 6;
          const s = Math.max(0.01, slot.life / slot.maxLife);
          slot.mesh.scale.setScalar(s);
          if (slot.life <= 0) slot.mesh.visible = false;
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
      envTarget.dispose();
      renderer.dispose();
    };
  }, [mobileInputRef, onTriggerInteractRef]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
      aria-label="Steal the Memeverse 3D Game World"
    />
  );
};
