export type RarityTier =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Epic'
  | 'Legendary'
  | 'Mythic'
  | 'Secret'
  | 'Celestial';

export type MutationType =
  | 'normal'
  | 'shiny'
  | 'golden'
  | 'diamond'
  | 'rainbow'
  | 'cosmic';

export type CreatureArchetype =
  | 'cat'
  | 'toast'
  | 'frog'
  | 'duck'
  | 'worm'
  | 'loaf'
  | 'bird'
  | 'knight'
  | 'banana'
  | 'crab'
  | 'capybara'
  | 'shark'
  | 'wizard'
  | 'llama'
  | 'owl'
  | 'goblin'
  | 'shiba'
  | 'octo'
  | 'dragon'
  | 'moth'
  | 'hamster'
  | 'toaster'
  | 'penguin'
  | 'flamingo'
  | 'pug'
  | 'drip'
  | 'axolotl'
  | 'goose'
  | 'glitch'
  | 'waffle'
  | 'leviathan';

export interface CreatureDefinition {
  id: string;
  name: string;
  tagline: string;
  rarity: RarityTier;
  archetype: CreatureArchetype;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  price: number;
  incomePerSec: number;
  stealValue: number;
  spawnWeight: number;
  scale: number;
  ability: string;
  accessory: 'none' | 'crown' | 'halo' | 'shades' | 'wizardHat' | 'headphones' | 'horns' | 'propeller' | 'topHat' | 'orbitRing';
}

export interface OwnedMemeling {
  instanceId: string;
  creatureId: string;
  mutation: MutationType;
  level: number;
  slotIndex: number; // 0..maxSlots-1 on the base
  locked: boolean;
  favorite: boolean;
  acquiredAt: number;
  stolenFrom?: string;
}

export interface ConveyorItem {
  id: string;
  creatureId: string;
  mutation: MutationType;
  lane: 0 | 1;
  progress: number; // 0 to 1 along conveyor
  price: number;
  spawnedAt: number;
}

export interface CarriedMemeling {
  instanceId: string;
  creatureId: string;
  mutation: MutationType;
  level: number;
  fromBaseIndex: number;
  fromPlayerId: string;
  fromPlayerName: string;
  stolenAt: number;
}

export interface PlayerUpgrades {
  baseSlots: number; // 0..6 (starts at 6 slots, +1 per level up to 12)
  lockDuration: number; // 0..5 (+10s per level)
  speedBoots: number; // 0..5 (+10% speed per level)
  incomeBoost: number; // 0..6 (+20% income per level)
  stealHands: number; // 0..5 (faster carry speed & steal range)
  securityTurret: number; // 0..3 (slows intruders)
}

export interface QuestProgress {
  id: string;
  title: string;
  description: string;
  type: 'buy' | 'steal' | 'earn' | 'lock' | 'lucky';
  target: number;
  progress: number;
  rewardCoins: number;
  rewardGems: number;
  claimed: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  avatarColor: string;
  skinId: string;
  baseTheme: string;
  baseIndex: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  isMoving: boolean;
  isSprinting: boolean;
  isInvisibleUntil: number;
  coins: number;
  gems: number;
  totalEarned: number;
  incomePerSec: number;
  level: number;
  xp: number;
  xpToNext: number;
  rebirths: number;
  rebirthMultiplier: number;
  stealsCount: number;
  timesStolenFrom: number;
  discoveredIds: string[];
  unlockedSkins: string[];
  unlockedThemes: string[];
  upgrades: PlayerUpgrades;
  memelings: OwnedMemeling[];
  carrying: CarriedMemeling | null;
  baseLockedUntil: number;
  baseLockCooldownUntil: number;
  dailyStreak: number;
  lastDailyClaimAt: number;
  skyChestCooldownUntil: number;
  quests: QuestProgress[];
}

export type WorldEventType =
  | 'golden_hour'
  | 'double_income'
  | 'rainbow_storm'
  | 'lucky_hour'
  | 'meteor_shower'
  | 'cosmic_portal';

export interface ActiveWorldEvent {
  type: WorldEventType;
  name: string;
  description: string;
  startedAt: number;
  endsAt: number;
  incomeMultiplier: number;
  luckMultiplier: number;
  accentHex: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  accent?: string;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  fromInstanceIds: string[];
  toInstanceIds: string[];
  fromReady: boolean;
  toReady: boolean;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  isBot: boolean;
  coins: number;
  incomePerSec: number;
  rebirths: number;
  stealsCount: number;
  memelingCount: number;
  avatarColor: string;
}

export interface WorldAlert {
  id: string;
  kind: 'rare_spawn' | 'theft' | 'heist_success' | 'rebirth' | 'event' | 'info' | 'error';
  title: string;
  message: string;
  accentColor: string;
  timestamp: number;
}

export interface WorldSnapshot {
  serverTime: number;
  players: PlayerState[];
  conveyor: ConveyorItem[];
  activeEvent: ActiveWorldEvent | null;
  nextEventAt: number;
  leaderboard: LeaderboardEntry[];
  chat: ChatMessage[];
  activeTrade: TradeOffer | null;
}

export interface LuckyBlockResult {
  tier: 'basic' | 'epic' | 'celestial';
  creatureId: string;
  mutation: MutationType;
  bonusCoins: number;
  addedToBase: boolean;
}
