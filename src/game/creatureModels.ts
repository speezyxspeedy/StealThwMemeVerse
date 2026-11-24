import * as THREE from 'three';
import { CREATURE_BY_ID, MUTATION_META, RARITY_META } from '../shared/creatures';
import type { CreatureDefinition, MutationType } from '../shared/types';

// Shared reusable primitive geometries to minimize memory & draw overhead
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 16, 14),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
  torus: new THREE.TorusGeometry(0.5, 0.1, 10, 24),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  capsule: new THREE.CapsuleGeometry(0.32, 0.45, 6, 12),
};

const EYE_WHITE_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.05 });
const EYE_PUPIL_MAT = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.2 });
const DARK_TRIM_MAT = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.65 });
const GOLD_METAL_MAT = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.18, metalness: 0.9 });

function makeCreatureMaterials(def: CreatureDefinition, mutation: MutationType) {
  let primaryHex = def.primaryColor;
  let secondaryHex = def.secondaryColor;
  let accentHex = def.accentColor;
  let metalness = 0.08;
  let roughness = 0.58;
  let emissiveColor = 0x000000;
  let emissiveIntensity = 0;

  if (mutation === 'shiny') {
    metalness = 0.45;
    roughness = 0.22;
    emissiveColor = 0x22d3ee;
    emissiveIntensity = 0.22;
  } else if (mutation === 'golden') {
    primaryHex = '#f59e0b';
    secondaryHex = '#fef08a';
    accentHex = '#ffffff';
    metalness = 0.88;
    roughness = 0.18;
    emissiveColor = 0xf59e0b;
    emissiveIntensity = 0.16;
  } else if (mutation === 'diamond') {
    primaryHex = '#38bdf8';
    secondaryHex = '#e0f2fe';
    accentHex = '#60a5fa';
    metalness = 0.72;
    roughness = 0.1;
    emissiveColor = 0x38bdf8;
    emissiveIntensity = 0.28;
  } else if (mutation === 'rainbow') {
    metalness = 0.55;
    roughness = 0.18;
    emissiveColor = 0xec4899;
    emissiveIntensity = 0.32;
  } else if (mutation === 'cosmic') {
    primaryHex = '#312e81';
    secondaryHex = '#a855f7';
    accentHex = '#38bdf8';
    metalness = 0.75;
    roughness = 0.16;
    emissiveColor = 0x7c3aed;
    emissiveIntensity = 0.48;
  }

  const primary = new THREE.MeshStandardMaterial({
    color: new THREE.Color(primaryHex),
    roughness,
    metalness,
    emissive: new THREE.Color(emissiveColor),
    emissiveIntensity,
  });

  const secondary = new THREE.MeshStandardMaterial({
    color: new THREE.Color(secondaryHex),
    roughness: Math.min(0.85, roughness + 0.25),
    metalness: Math.max(0.02, metalness - 0.2),
  });

  const accent = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    roughness: 0.24,
    metalness: 0.55,
    emissive: new THREE.Color(accentHex),
    emissiveIntensity: RARITY_META[def.rarity].order >= 5 ? 0.35 : 0.12,
  });

  return { primary, secondary, accent };
}

function addEyes(parent: THREE.Group, y: number, z: number, spacing = 0.22, size = 0.14): void {
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(GEO.sphere, EYE_WHITE_MAT);
    eye.scale.setScalar(size * 2);
    eye.position.set(side * spacing, y, z);
    parent.add(eye);

    const pupil = new THREE.Mesh(GEO.sphere, EYE_PUPIL_MAT);
    pupil.scale.setScalar(size * 1.15);
    pupil.position.set(side * spacing, y, z + size * 0.65);
    parent.add(pupil);
  }
}

function addAccessory(
  parent: THREE.Group,
  accessory: CreatureDefinition['accessory'],
  topY: number,
  accentMat: THREE.Material,
  orbitTargets: THREE.Object3D[],
): void {
  if (accessory === 'crown') {
    const crown = new THREE.Group();
    crown.position.y = topY + 0.08;
    const band = new THREE.Mesh(GEO.cyl, GOLD_METAL_MAT);
    band.scale.set(0.42, 0.14, 0.42);
    crown.add(band);
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(GEO.cone, GOLD_METAL_MAT);
      const ang = (i * Math.PI) / 2;
      spike.scale.set(0.12, 0.22, 0.12);
      spike.position.set(Math.cos(ang) * 0.16, 0.14, Math.sin(ang) * 0.16);
      crown.add(spike);
    }
    parent.add(crown);
  } else if (accessory === 'halo') {
    const halo = new THREE.Mesh(GEO.torus, GOLD_METAL_MAT);
    halo.rotation.x = Math.PI / 2;
    halo.scale.set(0.68, 0.68, 0.68);
    halo.position.y = topY + 0.34;
    parent.add(halo);
    orbitTargets.push(halo);
  } else if (accessory === 'shades') {
    const glasses = new THREE.Group();
    glasses.position.set(0, topY - 0.32, 0.44);
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(GEO.box, DARK_TRIM_MAT);
      lens.scale.set(0.24, 0.13, 0.06);
      lens.position.x = side * 0.17;
      glasses.add(lens);
    }
    const bridge = new THREE.Mesh(GEO.box, accentMat);
    bridge.scale.set(0.16, 0.04, 0.05);
    glasses.add(bridge);
    parent.add(glasses);
  } else if (accessory === 'wizardHat') {
    const brim = new THREE.Mesh(GEO.cyl, accentMat);
    brim.scale.set(0.75, 0.06, 0.75);
    brim.position.y = topY + 0.02;
    parent.add(brim);
    const cone = new THREE.Mesh(GEO.cone, accentMat);
    cone.scale.set(0.46, 0.65, 0.46);
    cone.position.y = topY + 0.35;
    cone.rotation.z = 0.12;
    parent.add(cone);
  } else if (accessory === 'headphones') {
    const arch = new THREE.Mesh(GEO.torus, DARK_TRIM_MAT);
    arch.scale.set(0.86, 0.86, 0.86);
    arch.position.y = topY - 0.2;
    parent.add(arch);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(GEO.cyl, accentMat);
      cup.rotation.z = Math.PI / 2;
      cup.scale.set(0.26, 0.14, 0.26);
      cup.position.set(side * 0.48, topY - 0.26, 0);
      parent.add(cup);
    }
  } else if (accessory === 'horns') {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(GEO.cone, accentMat);
      horn.scale.set(0.16, 0.38, 0.16);
      horn.position.set(side * 0.24, topY + 0.16, 0.05);
      horn.rotation.z = -side * 0.35;
      parent.add(horn);
    }
  } else if (accessory === 'propeller') {
    const cap = new THREE.Mesh(GEO.sphere, accentMat);
    cap.scale.set(0.42, 0.2, 0.42);
    cap.position.y = topY + 0.02;
    parent.add(cap);
    const blade = new THREE.Mesh(GEO.box, GOLD_METAL_MAT);
    blade.scale.set(0.65, 0.04, 0.1);
    blade.position.y = topY + 0.16;
    parent.add(blade);
    orbitTargets.push(blade);
  } else if (accessory === 'topHat') {
    const brim = new THREE.Mesh(GEO.cyl, DARK_TRIM_MAT);
    brim.scale.set(0.66, 0.06, 0.66);
    brim.position.y = topY + 0.03;
    parent.add(brim);
    const tube = new THREE.Mesh(GEO.cyl, DARK_TRIM_MAT);
    tube.scale.set(0.42, 0.46, 0.42);
    tube.position.y = topY + 0.26;
    parent.add(tube);
    const ribbon = new THREE.Mesh(GEO.cyl, GOLD_METAL_MAT);
    ribbon.scale.set(0.44, 0.08, 0.44);
    ribbon.position.y = topY + 0.1;
    parent.add(ribbon);
  } else if (accessory === 'orbitRing') {
    const ring = new THREE.Mesh(GEO.torus, accentMat);
    ring.scale.set(1.45, 1.45, 1.45);
    ring.position.y = topY * 0.58;
    ring.rotation.x = Math.PI * 0.36;
    parent.add(ring);
    orbitTargets.push(ring);
  }
}

export interface AnimatedCreatureRig {
  root: THREE.Group;
  body: THREE.Group;
  orbitTargets: THREE.Object3D[];
  rainbowMat: THREE.MeshStandardMaterial | null;
  phase: number;
}

export function createMemelingMesh(
  creatureId: string,
  mutation: MutationType = 'normal',
): AnimatedCreatureRig {
  const def = CREATURE_BY_ID[creatureId] ?? CREATURE_BY_ID['bloop-cat'];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const { primary, secondary, accent } = makeCreatureMaterials(def, mutation);
  const orbitTargets: THREE.Object3D[] = [];
  let topY = 1.1;

  // Build distinctive 4–12 part silhouettes per creature archetype
  switch (def.archetype) {
    case 'toast':
    case 'waffle': {
      const slice = new THREE.Mesh(GEO.box, primary);
      slice.scale.set(0.95, 1.05, 0.36);
      slice.position.y = 0.62;
      body.add(slice);

      const crust = new THREE.Mesh(GEO.box, secondary);
      crust.scale.set(0.78, 0.86, 0.4);
      crust.position.y = 0.62;
      body.add(crust);

      const pat = new THREE.Mesh(GEO.box, accent);
      pat.scale.set(0.28, 0.28, 0.14);
      pat.position.set(0.12, 0.78, 0.22);
      pat.rotation.z = 0.35;
      body.add(pat);

      for (const side of [-1, 1]) {
        const foot = new THREE.Mesh(GEO.box, DARK_TRIM_MAT);
        foot.scale.set(0.18, 0.18, 0.26);
        foot.position.set(side * 0.24, 0.09, 0.04);
        body.add(foot);
      }
      addEyes(body, 0.66, 0.22, 0.2, 0.12);
      topY = 1.15;
      break;
    }

    case 'duck':
    case 'goose':
    case 'bird':
    case 'owl':
    case 'flamingo': {
      const torso = new THREE.Mesh(GEO.sphere, primary);
      torso.scale.set(0.85, 0.72, 1.02);
      torso.position.set(0, 0.52, -0.05);
      body.add(torso);

      const head = new THREE.Mesh(GEO.sphere, primary);
      head.scale.set(0.62, 0.62, 0.62);
      head.position.set(0, def.archetype === 'flamingo' || def.archetype === 'goose' ? 1.16 : 0.96, 0.22);
      body.add(head);

      if (def.archetype === 'flamingo' || def.archetype === 'goose') {
        const neck = new THREE.Mesh(GEO.cyl, primary);
        neck.scale.set(0.18, 0.52, 0.18);
        neck.position.set(0, 0.88, 0.18);
        body.add(neck);
      }

      const beak = new THREE.Mesh(GEO.cone, secondary);
      beak.rotation.x = Math.PI / 2;
      beak.scale.set(0.26, 0.36, 0.16);
      beak.position.set(0, head.position.y - 0.05, 0.6);
      body.add(beak);

      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(GEO.box, accent);
        wing.scale.set(0.14, 0.36, 0.56);
        wing.position.set(side * 0.46, 0.56, -0.05);
        wing.rotation.z = side * 0.22;
        body.add(wing);

        const leg = new THREE.Mesh(GEO.cyl, secondary);
        leg.scale.set(0.08, 0.34, 0.08);
        leg.position.set(side * 0.18, 0.17, 0);
        body.add(leg);
      }
      addEyes(body, head.position.y + 0.06, 0.48, 0.16, 0.11);
      topY = head.position.y + 0.32;
      break;
    }

    case 'banana':
    case 'worm': {
      for (let i = 0; i < 4; i++) {
        const seg = new THREE.Mesh(GEO.sphere, i % 2 === 0 ? primary : secondary);
        const s = 0.54 - i * 0.04;
        seg.scale.set(s, s * 1.1, s);
        seg.position.set(0, 0.28 + i * 0.28, Math.sin(i * 0.65) * 0.16);
        body.add(seg);
      }
      const stem = new THREE.Mesh(GEO.cyl, DARK_TRIM_MAT);
      stem.scale.set(0.1, 0.22, 0.1);
      stem.position.set(0, 1.38, 0.06);
      body.add(stem);
      addEyes(body, 0.88, 0.36, 0.15, 0.11);
      topY = 1.42;
      break;
    }

    case 'shark':
    case 'dragon':
    case 'leviathan': {
      const hull = new THREE.Mesh(GEO.capsule, primary);
      hull.rotation.x = Math.PI / 2;
      hull.scale.set(1.15, 1.35, 1.0);
      hull.position.set(0, 0.62, 0);
      body.add(hull);

      const belly = new THREE.Mesh(GEO.box, secondary);
      belly.scale.set(0.55, 0.24, 0.9);
      belly.position.set(0, 0.42, 0.06);
      body.add(belly);

      const dorsal = new THREE.Mesh(GEO.cone, accent);
      dorsal.scale.set(0.18, 0.48, 0.42);
      dorsal.position.set(0, 1.04, -0.05);
      dorsal.rotation.x = -0.35;
      body.add(dorsal);

      const tail = new THREE.Mesh(GEO.cone, accent);
      tail.scale.set(0.32, 0.54, 0.14);
      tail.position.set(0, 0.65, -0.78);
      tail.rotation.x = -Math.PI / 2;
      body.add(tail);

      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(GEO.box, primary);
        fin.scale.set(0.45, 0.08, 0.32);
        fin.position.set(side * 0.52, 0.52, 0.1);
        fin.rotation.z = -side * 0.25;
        body.add(fin);
      }
      addEyes(body, 0.72, 0.54, 0.24, 0.12);
      topY = 1.18;
      break;
    }

    case 'crab':
    case 'octo': {
      const dome = new THREE.Mesh(GEO.sphere, primary);
      dome.scale.set(0.98, 0.72, 0.88);
      dome.position.y = 0.64;
      body.add(dome);

      const legCount = def.archetype === 'octo' ? 6 : 4;
      for (let i = 0; i < legCount; i++) {
        const ang = (i / legCount) * Math.PI * 2;
        const limb = new THREE.Mesh(GEO.cyl, secondary);
        limb.scale.set(0.14, 0.52, 0.14);
        limb.position.set(Math.cos(ang) * 0.46, 0.24, Math.sin(ang) * 0.42);
        limb.rotation.z = Math.cos(ang) * 0.5;
        limb.rotation.x = -Math.sin(ang) * 0.4;
        body.add(limb);
      }

      if (def.archetype === 'crab') {
        for (const side of [-1, 1]) {
          const claw = new THREE.Mesh(GEO.sphere, accent);
          claw.scale.set(0.34, 0.28, 0.38);
          claw.position.set(side * 0.62, 0.78, 0.35);
          body.add(claw);
        }
      }
      addEyes(body, 0.82, 0.42, 0.22, 0.13);
      topY = 1.02;
      break;
    }

    case 'toaster':
    case 'glitch': {
      const chassis = new THREE.Mesh(GEO.box, primary);
      chassis.scale.set(0.92, 0.82, 0.66);
      chassis.position.y = 0.52;
      body.add(chassis);

      const trim = new THREE.Mesh(GEO.box, secondary);
      trim.scale.set(0.98, 0.14, 0.72);
      trim.position.y = 0.14;
      body.add(trim);

      const toastTop = new THREE.Mesh(GEO.box, accent);
      toastTop.scale.set(0.58, 0.34, 0.22);
      toastTop.position.set(0, 1.02, 0);
      body.add(toastTop);

      const lever = new THREE.Mesh(GEO.sphere, GOLD_METAL_MAT);
      lever.scale.setScalar(0.2);
      lever.position.set(0.52, 0.52, 0);
      body.add(lever);

      addEyes(body, 0.58, 0.35, 0.2, 0.13);
      topY = 1.22;
      break;
    }

    case 'frog':
    case 'capybara':
    case 'loaf':
    case 'hamster': {
      const chonk = new THREE.Mesh(GEO.box, primary);
      chonk.scale.set(0.95, 0.76, 1.02);
      chonk.position.y = 0.46;
      body.add(chonk);

      const belly = new THREE.Mesh(GEO.box, secondary);
      belly.scale.set(0.72, 0.42, 1.05);
      belly.position.y = 0.34;
      body.add(belly);

      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(GEO.sphere, primary);
        ear.scale.set(0.24, 0.24, 0.24);
        ear.position.set(side * 0.32, 0.9, 0.24);
        body.add(ear);

        const paw = new THREE.Mesh(GEO.box, secondary);
        paw.scale.set(0.24, 0.16, 0.28);
        paw.position.set(side * 0.32, 0.08, 0.32);
        body.add(paw);
      }

      if (def.archetype === 'capybara') {
        // Signature orange tangerine resting on head
        const yuzu = new THREE.Mesh(GEO.sphere, accent);
        yuzu.scale.setScalar(0.32);
        yuzu.position.set(0, 0.98, 0.14);
        body.add(yuzu);
      }

      addEyes(body, 0.64, 0.52, 0.24, 0.13);
      topY = 0.94;
      break;
    }

    default: {
      // Cat, Shiba, Pug, Axolotl, Goblin, Knight, Wizard, Llama, Penguin, Moth, Drip
      const torso = new THREE.Mesh(GEO.capsule, primary);
      torso.scale.set(1.1, 1.0, 1.05);
      torso.position.y = 0.56;
      body.add(torso);

      const tummy = new THREE.Mesh(GEO.sphere, secondary);
      tummy.scale.set(0.56, 0.52, 0.4);
      tummy.position.set(0, 0.48, 0.22);
      body.add(tummy);

      const head = new THREE.Mesh(GEO.sphere, primary);
      head.scale.set(0.76, 0.72, 0.74);
      head.position.set(0, 0.96, 0.05);
      body.add(head);

      // Ears / gills / wings depending on type
      for (const side of [-1, 1]) {
        if (def.archetype === 'moth') {
          const wing = new THREE.Mesh(GEO.box, accent);
          wing.scale.set(0.66, 0.52, 0.08);
          wing.position.set(side * 0.56, 0.68, -0.18);
          wing.rotation.y = -side * 0.3;
          body.add(wing);
        } else if (def.archetype === 'axolotl') {
          for (let g = 0; g < 2; g++) {
            const gill = new THREE.Mesh(GEO.cone, accent);
            gill.scale.set(0.14, 0.34, 0.14);
            gill.position.set(side * 0.42, 0.96 + g * 0.12, 0);
            gill.rotation.z = -side * (1.1 + g * 0.25);
            body.add(gill);
          }
        } else {
          const ear = new THREE.Mesh(GEO.cone, primary);
          ear.scale.set(0.22, 0.34, 0.22);
          ear.position.set(side * 0.24, 1.32, 0.04);
          ear.rotation.z = -side * 0.2;
          body.add(ear);
        }

        const foot = new THREE.Mesh(GEO.sphere, secondary);
        foot.scale.set(0.24, 0.18, 0.32);
        foot.position.set(side * 0.22, 0.09, 0.12);
        body.add(foot);
      }

      const nose = new THREE.Mesh(GEO.sphere, accent);
      nose.scale.set(0.14, 0.1, 0.12);
      nose.position.set(0, 0.9, 0.42);
      body.add(nose);

      addEyes(body, 1.0, 0.38, 0.18, 0.12);
      topY = 1.32;
      break;
    }
  }

  addAccessory(body, def.accessory, topY, accent, orbitTargets);

  // Rarity aura base ring for Epic+ or mutated Memelings
  const rarityOrder = RARITY_META[def.rarity].order;
  if (rarityOrder >= 4 || mutation !== 'normal') {
    const auraColor = mutation !== 'normal' ? MUTATION_META[mutation].color : RARITY_META[def.rarity].color;
    const auraMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(auraColor),
      emissive: new THREE.Color(auraColor),
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.6,
    });
    const ring = new THREE.Mesh(GEO.torus, auraMat);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1.15, 1.15, 0.6);
    ring.position.y = 0.06;
    root.add(ring);
    orbitTargets.push(ring);
  }

  root.scale.setScalar(def.scale);
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return {
    root,
    body,
    orbitTargets,
    rainbowMat: mutation === 'rainbow' ? primary : null,
    phase: Math.random() * Math.PI * 2,
  };
}

export interface PlayerAvatarRig {
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  carryAnchor: THREE.Group;
  torsoMat: THREE.MeshStandardMaterial;
  labelSprite: THREE.Sprite;
  currentColor: string;
  currentName: string;
  carriedId: string | null;
}

export function createPlayerAvatarMesh(colorHex: string, labelTex: THREE.Texture): PlayerAvatarRig {
  const root = new THREE.Group();

  const torsoMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.38,
    metalness: 0.22,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.62, metalness: 0.04 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.1 });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.12,
    metalness: 0.85,
  });

  const leftLeg = new THREE.Mesh(GEO.box, pantsMat);
  leftLeg.scale.set(0.28, 0.65, 0.3);
  leftLeg.position.set(-0.18, 0.33, 0);
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(GEO.box, pantsMat);
  rightLeg.scale.set(0.28, 0.65, 0.3);
  rightLeg.position.set(0.18, 0.33, 0);
  root.add(rightLeg);

  const torso = new THREE.Mesh(GEO.box, torsoMat);
  torso.scale.set(0.74, 0.78, 0.44);
  torso.position.set(0, 1.02, 0);
  root.add(torso);

  const backpack = new THREE.Mesh(GEO.box, DARK_TRIM_MAT);
  backpack.scale.set(0.52, 0.56, 0.24);
  backpack.position.set(0, 1.05, -0.32);
  root.add(backpack);

  const leftArm = new THREE.Mesh(GEO.box, torsoMat);
  leftArm.scale.set(0.22, 0.68, 0.24);
  leftArm.position.set(-0.5, 1.0, 0);
  root.add(leftArm);

  const rightArm = new THREE.Mesh(GEO.box, torsoMat);
  rightArm.scale.set(0.22, 0.68, 0.24);
  rightArm.position.set(0.5, 1.0, 0);
  root.add(rightArm);

  const head = new THREE.Mesh(GEO.box, skinMat);
  head.scale.set(0.58, 0.56, 0.56);
  head.position.set(0, 1.72, 0);
  root.add(head);

  const hairCap = new THREE.Mesh(GEO.box, torsoMat);
  hairCap.scale.set(0.62, 0.18, 0.6);
  hairCap.position.set(0, 2.02, -0.02);
  root.add(hairCap);

  const visor = new THREE.Mesh(GEO.box, visorMat);
  visor.scale.set(0.46, 0.18, 0.1);
  visor.position.set(0, 1.76, 0.28);
  root.add(visor);

  const carryAnchor = new THREE.Group();
  carryAnchor.position.set(0, 2.28, 0.1);
  root.add(carryAnchor);

  const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
  const labelSprite = new THREE.Sprite(labelMat);
  labelSprite.scale.set(2.8, 0.85, 1);
  labelSprite.position.set(0, 2.72, 0);
  root.add(labelSprite);

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return {
    root,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    carryAnchor,
    torsoMat,
    labelSprite,
    currentColor: colorHex,
    currentName: '',
    carriedId: null,
  };
}
