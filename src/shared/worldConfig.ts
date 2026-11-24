import { PlayerUpgrades, QuestProgress, WorldEventType } from './types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BasePlotLayout {
  index: number;
  center: Vec3;
  facingYaw: number; // angle facing toward the central plaza
  spawnPoint: Vec3;
  lockTerminal: Vec3;
  depositPad: Vec3;
  pedestals: Vec3[]; // 12 pedestal world coordinates
  accentColor: string;
}

export const WORLD_RADIUS = 62;
export const CONVEYOR_START_Z = -22;
export const CONVEYOR_END_Z = 22;
export const CONVEYOR_LANE_X: [number, number] = [-2.2, 2.2];
export const CONVEYOR_HEIGHT = 1.05;

export function getConveyorWorldPosition(lane: 0 | 1, progress: number): Vec3 {
  return {
    x: CONVEYOR_LANE_X[lane],
    y: CONVEYOR_HEIGHT,
    z: CONVEYOR_START_Z + (CONVEYOR_END_Z - CONVEYOR_START_Z) * progress,
  };
}

const BASE_COLORS = [
  '#38bdf8',
  '#f43f5e',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#fb923c',
];

// 8 personal bases arranged symmetrically on East and West flanks of the central conveyor
export const BASE_PLOTS: BasePlotLayout[] = (() => {
  const plots: BasePlotLayout[] = [];
  const zOffsets = [-21, -7, 7, 21];
  const sideConfigs = [
    { x: -24, facingYaw: Math.PI / 2 }, // West bases face East (+X)
    { x: 24, facingYaw: -Math.PI / 2 }, // East bases face West (-X)
  ];

  let idx = 0;
  for (const side of sideConfigs) {
    for (const z of zOffsets) {
      const dirX = side.x < 0 ? 1 : -1; // points toward center plaza
      const pedestals: Vec3[] = [];
      // 3 rows deep x 4 columns wide inside the 11x11 base plinth
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const localForward = 2.4 - row * 3.1;
          const localSide = (col - 1.5) * 2.55;
          pedestals.push({
            x: side.x + dirX * localForward,
            y: 0.55,
            z: z + localSide,
          });
        }
      }

      plots.push({
        index: idx,
        center: { x: side.x, y: 0, z },
        facingYaw: side.facingYaw,
        spawnPoint: { x: side.x + dirX * 7.8, y: 0, z },
        lockTerminal: { x: side.x + dirX * 5.8, y: 0, z: z - 4.4 },
        depositPad: { x: side.x + dirX * 5.6, y: 0.1, z: z + 2.6 },
        pedestals,
        accentColor: BASE_COLORS[idx % BASE_COLORS.length],
      });
      idx++;
    }
  }
  return plots;
})();

export const LANDMARKS = {
  spawnPlaza: { x: 0, y: 0, z: 32 },
  upgradeShop: { x: -13, y: 0, z: 33 },
  rebirthShrine: { x: 13, y: 0, z: 33 },
  luckyBlockZone: { x: 0, y: 0, z: -31 },
  leaderboardMonument: { x: -14, y: 0, z: -31 },
  tradingPlaza: { x: 14, y: 0, z: -31 },
  skyChest: { x: 0, y: 8.6, z: -47 },
};

// Stepping stones for the Sky Obby leading to the Sky Treasure Chest
export const OBBY_PLATFORMS: Array<{ x: number; y: number; z: number; rx: number; rz: number; color: string }> = [
  { x: 0, y: 1.3, z: -36.5, rx: 2.2, rz: 1.8, color: '#38bdf8' },
  { x: -3.2, y: 2.7, z: -39.2, rx: 2.0, rz: 1.7, color: '#a855f7' },
  { x: 0.5, y: 4.1, z: -41.5, rx: 2.0, rz: 1.7, color: '#f43f5e' },
  { x: 3.6, y: 5.6, z: -43.2, rx: 2.0, rz: 1.7, color: '#f59e0b' },
  { x: 0.8, y: 7.0, z: -44.8, rx: 2.1, rz: 1.7, color: '#22c55e' },
  { x: 0, y: 8.2, z: -47.2, rx: 3.4, rz: 2.8, color: '#facc15' },
];

export interface UpgradeCatalogItem {
  key: keyof PlayerUpgrades;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  effectPerLevel: string;
}

export const UPGRADE_CATALOG: UpgradeCatalogItem[] = [
  {
    key: 'baseSlots',
    name: 'Base Pedestal Expansion',
    description: 'Unlock additional Memeling display pedestals inside your base.',
    maxLevel: 6,
    baseCost: 450,
    costMultiplier: 2.8,
    effectPerLevel: '+1 Memeling Slot',
  },
  {
    key: 'lockDuration',
    name: 'Laser Shield Capacitor',
    description: 'Extends how long your base laser shield blocks thieves.',
    maxLevel: 5,
    baseCost: 320,
    costMultiplier: 2.4,
    effectPerLevel: '+10s Shield Duration',
  },
  {
    key: 'speedBoots',
    name: 'Turbo Sneakers',
    description: 'Boosts base running and escape speed across the Memeverse.',
    maxLevel: 5,
    baseCost: 260,
    costMultiplier: 2.3,
    effectPerLevel: '+10% Move Speed',
  },
  {
    key: 'incomeBoost',
    name: 'Meme Minting Core',
    description: 'Amplifies passive coin generation from every owned Memeling.',
    maxLevel: 6,
    baseCost: 600,
    costMultiplier: 2.9,
    effectPerLevel: '+25% Passive Income',
  },
  {
    key: 'stealHands',
    name: 'Sticky Gloves',
    description: 'Carry stolen Memelings faster and snatch from wider range.',
    maxLevel: 5,
    baseCost: 380,
    costMultiplier: 2.5,
    effectPerLevel: '+12% Carry Speed',
  },
  {
    key: 'securityTurret',
    name: 'Zap Defense Field',
    description: 'Slows down rival raiders who step onto your unlocked base.',
    maxLevel: 3,
    baseCost: 900,
    costMultiplier: 3.1,
    effectPerLevel: 'Slows Raiders -15%',
  },
];

export function getUpgradeCost(key: keyof PlayerUpgrades, currentLevel: number): number {
  const item = UPGRADE_CATALOG.find((u) => u.key === key);
  if (!item) return 999999999;
  return Math.round(item.baseCost * Math.pow(item.costMultiplier, currentLevel));
}

export interface CosmeticItem {
  id: string;
  name: string;
  category: 'skin' | 'theme';
  color: string;
  accent: string;
  gemCost: number;
  tag: string;
}

export const COSMETIC_CATALOG: CosmeticItem[] = [
  { id: 'classic', name: 'Plaza Explorer', category: 'skin', color: '#38bdf8', accent: '#f8fafc', gemCost: 0, tag: 'Starter' },
  { id: 'crimson-raider', name: 'Crimson Raider', category: 'skin', color: '#f43f5e', accent: '#fde047', gemCost: 15, tag: 'Heist' },
  { id: 'emerald-hacker', name: 'Matrix Mint', category: 'skin', color: '#10b981', accent: '#0f172a', gemCost: 25, tag: 'Tech' },
  { id: 'royal-gold', name: '24K Tycoon', category: 'skin', color: '#f59e0b', accent: '#fef08a', gemCost: 45, tag: 'Prestige' },
  { id: 'void-walker', name: 'Cosmic Phantom', category: 'skin', color: '#8b5cf6', accent: '#67e8f9', gemCost: 70, tag: 'Mythic' },
  { id: 'theme-marble', name: 'Plaza Marble', category: 'theme', color: '#e2e8f0', accent: '#38bdf8', gemCost: 0, tag: 'Starter' },
  { id: 'theme-obsidian', name: 'Obsidian Vault', category: 'theme', color: '#1e293b', accent: '#f43f5e', gemCost: 20, tag: 'Vault' },
  { id: 'theme-gold', name: 'Gilded Citadel', category: 'theme', color: '#fbbf24', accent: '#fffbeb', gemCost: 50, tag: 'VIP' },
  { id: 'theme-celestial', name: 'Astral Sanctuary', category: 'theme', color: '#4c1d95', accent: '#67e8f9', gemCost: 85, tag: 'Celestial' },
];

export const LUCKY_BLOCK_TIERS = {
  basic: {
    name: 'Meme Crate',
    costCoins: 750,
    costGems: 0,
    luckMultiplier: 2.5,
    forceMutation: false,
    description: 'High chance of Uncommon, Rare, or Epic Memelings.',
    color: '#38bdf8',
  },
  epic: {
    name: 'Golden Vault Block',
    costCoins: 18000,
    costGems: 0,
    luckMultiplier: 8,
    forceMutation: false,
    description: 'Boosted Legendary & Mythic odds plus shiny mutation luck.',
    color: '#f59e0b',
  },
  celestial: {
    name: 'Celestial Prism',
    costCoins: 0,
    costGems: 20,
    luckMultiplier: 28,
    forceMutation: true,
    description: 'Guaranteed mutated Memeling with massive Secret & Celestial odds!',
    color: '#c084fc',
  },
} as const;

export function getRebirthRequirement(currentRebirths: number): {
  coinCost: number;
  nextMultiplier: number;
  gemReward: number;
} {
  const coinCost = Math.round(12000 * Math.pow(3.6, currentRebirths));
  const nextMultiplier = Number((1 + (currentRebirths + 1) * 0.75).toFixed(2));
  const gemReward = 15 + currentRebirths * 10;
  return { coinCost, nextMultiplier, gemReward };
}

export const WORLD_EVENTS_CATALOG: Array<{
  type: WorldEventType;
  name: string;
  description: string;
  durationMs: number;
  incomeMultiplier: number;
  luckMultiplier: number;
  accentHex: string;
}> = [
  {
    type: 'golden_hour',
    name: 'Golden Hour',
    description: '2x Passive Income and boosted Golden Memeling spawns!',
    durationMs: 45_000,
    incomeMultiplier: 2,
    luckMultiplier: 2.2,
    accentHex: '#fbbf24',
  },
  {
    type: 'rainbow_storm',
    name: 'Rainbow Storm',
    description: 'Prism clouds boost rare mutations by 4x on the conveyor!',
    durationMs: 45_000,
    incomeMultiplier: 1.5,
    luckMultiplier: 4,
    accentHex: '#ec4899',
  },
  {
    type: 'double_income',
    name: 'Meme Boom 2X',
    description: 'Every Memeling in the world generates double coins!',
    durationMs: 45_000,
    incomeMultiplier: 2,
    luckMultiplier: 1.5,
    accentHex: '#22c55e',
  },
  {
    type: 'lucky_hour',
    name: 'Lucky Frenzy',
    description: '3.5x Legendary, Mythic & Secret conveyor spawn odds!',
    durationMs: 45_000,
    incomeMultiplier: 1.25,
    luckMultiplier: 3.5,
    accentHex: '#38bdf8',
  },
  {
    type: 'meteor_shower',
    name: 'Meteor Shower',
    description: 'Cosmic meteors supercharge bases for 2.5x passive income!',
    durationMs: 40_000,
    incomeMultiplier: 2.5,
    luckMultiplier: 2.5,
    accentHex: '#f97316',
  },
  {
    type: 'cosmic_portal',
    name: 'Cosmic Rift',
    description: 'Celestial anomaly! 5x rare spawn luck and 2x coins!',
    durationMs: 40_000,
    incomeMultiplier: 2,
    luckMultiplier: 5,
    accentHex: '#a855f7',
  },
];

export function createStarterQuests(): QuestProgress[] {
  return [
    {
      id: 'q-buy-3',
      title: 'Conveyor Collector',
      description: 'Buy 3 Memelings from the central conveyor.',
      type: 'buy',
      target: 3,
      progress: 0,
      rewardCoins: 400,
      rewardGems: 5,
      claimed: false,
    },
    {
      id: 'q-lock-1',
      title: 'Vault Lockdown',
      description: 'Activate your Base Laser Shield once.',
      type: 'lock',
      target: 1,
      progress: 0,
      rewardCoins: 300,
      rewardGems: 4,
      claimed: false,
    },
    {
      id: 'q-steal-1',
      title: 'First Heist',
      description: 'Steal a Memeling from a rival base and deliver it home.',
      type: 'steal',
      target: 1,
      progress: 0,
      rewardCoins: 1200,
      rewardGems: 10,
      claimed: false,
    },
    {
      id: 'q-lucky-1',
      title: 'Feeling Lucky',
      description: 'Open 1 Lucky Block at the Lucky Zone.',
      type: 'lucky',
      target: 1,
      progress: 0,
      rewardCoins: 900,
      rewardGems: 8,
      claimed: false,
    },
    {
      id: 'q-earn-10k',
      title: 'Meme Tycoon',
      description: 'Earn 10,000 total Coins across your empire.',
      type: 'earn',
      target: 10000,
      progress: 0,
      rewardCoins: 2500,
      rewardGems: 15,
      claimed: false,
    },
  ];
}

export const BASE_LOCK_BASE_DURATION_MS = 35_000;
export const BASE_LOCK_COOLDOWN_MS = 18_000;
export const SNEAK_CLOAK_COST_GEMS = 5;
export const SNEAK_CLOAK_DURATION_MS = 14_000;
export const SKY_CHEST_COOLDOWN_MS = 90_000;
