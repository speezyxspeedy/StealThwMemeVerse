import fs from 'fs';
import path from 'path';
import type { Server, Socket } from 'socket.io';
import {
  CREATURE_BY_ID,
  CREATURES,
  getCreatureEffectiveIncome,
  getCreatureSellValue,
  MUTATION_META,
  RARITY_META,
  rollCreature,
  rollMutation,
} from '../shared/creatures.ts';
import type {
  ActiveWorldEvent,
  ChatMessage,
  ConveyorItem,
  LeaderboardEntry,
  LuckyBlockResult,
  OwnedMemeling,
  PlayerState,
  PlayerUpgrades,
  TradeOffer,
  WorldAlert,
  WorldSnapshot,
} from '../shared/types.ts';
import {
  BASE_LOCK_BASE_DURATION_MS,
  BASE_LOCK_COOLDOWN_MS,
  BASE_PLOTS,
  COSMETIC_CATALOG,
  createStarterQuests,
  getConveyorWorldPosition,
  getRebirthRequirement,
  getUpgradeCost,
  LANDMARKS,
  LUCKY_BLOCK_TIERS,
  SKY_CHEST_COOLDOWN_MS,
  SNEAK_CLOAK_COST_GEMS,
  SNEAK_CLOAK_DURATION_MS,
  UPGRADE_CATALOG,
  WORLD_EVENTS_CATALOG,
  WORLD_RADIUS,
} from '../shared/worldConfig.ts';

interface PersistedProfile {
  token: string;
  name: string;
  avatarColor: string;
  skinId: string;
  baseTheme: string;
  coins: number;
  gems: number;
  totalEarned: number;
  level: number;
  xp: number;
  rebirths: number;
  stealsCount: number;
  timesStolenFrom: number;
  discoveredIds: string[];
  unlockedSkins: string[];
  unlockedThemes: string[];
  upgrades: PlayerUpgrades;
  memelings: OwnedMemeling[];
  dailyStreak: number;
  lastDailyClaimAt: number;
  quests: PlayerState['quests'];
}

interface BotBrain {
  state: 'roam' | 'buy' | 'raid' | 'return';
  targetX: number;
  targetZ: number;
  targetConveyorId?: string;
  targetBaseIndex?: number;
  nextDecisionAt: number;
}

const SAVE_DIR = path.resolve(process.cwd(), 'data');
const SAVE_FILE = path.join(SAVE_DIR, 'memeverse-save.json');

const BOT_ROSTER = [
  {
    id: 'bot-baron',
    name: 'BaronVonBloop',
    avatarColor: '#f43f5e',
    skinId: 'crimson-raider',
    baseTheme: 'theme-obsidian',
    starterIds: ['bloop-cat', 'turbo-pigeon', 'caffeinated-shark'],
  },
  {
    id: 'bot-toast',
    name: 'SirToastALot',
    avatarColor: '#f59e0b',
    skinId: 'royal-gold',
    baseTheme: 'theme-gold',
    starterIds: ['soggy-toast', 'pickle-knight', 'taco-wizard', 'cyber-shiba'],
  },
  {
    id: 'bot-noodle',
    name: 'NoodleWizard',
    avatarColor: '#a855f7',
    skinId: 'void-walker',
    baseTheme: 'theme-celestial',
    starterIds: ['noodle-worm', 'disco-crab', 'laser-llama'],
  },
  {
    id: 'bot-quack',
    name: 'CaptainQuack',
    avatarColor: '#10b981',
    skinId: 'emerald-hacker',
    baseTheme: 'theme-marble',
    starterIds: ['wobbly-duck', 'vibe-capybara', 'boombox-owl'],
  },
];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function dist2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, maxLen);
}

export class MemeverseGameServer {
  private io: Server;
  private players = new Map<string, PlayerState>();
  private socketToPlayerId = new Map<string, string>();
  private playerTokenMap = new Map<string, string>(); // playerId -> token
  private savedProfiles = new Map<string, PersistedProfile>();
  private botBrains = new Map<string, BotBrain>();
  private conveyor: ConveyorItem[] = [];
  private chat: ChatMessage[] = [];
  private trades = new Map<string, TradeOffer>();
  private activeEvent: ActiveWorldEvent | null = null;
  private nextEventAt: number = Date.now() + 45_000;
  private lastConveyorSpawnAt = 0;
  private lastTickAt = Date.now();
  private lastSaveAt = Date.now();
  private actionRateLimits = new Map<string, number>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;

  constructor(io: Server) {
    this.io = io;
    this.loadPersistence();
    this.seedInitialWorld();
    this.bindSocketHandlers();
    this.startLoops();
  }

  private loadPersistence(): void {
    try {
      if (fs.existsSync(SAVE_FILE)) {
        const raw = fs.readFileSync(SAVE_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, PersistedProfile>;
        for (const [token, profile] of Object.entries(parsed)) {
          if (profile && typeof profile.token === 'string') {
            this.savedProfiles.set(token, profile);
          }
        }
      }
    } catch {
      // Fresh persistence state if file unreadable
    }
  }

  private savePersistence(): void {
    try {
      for (const player of this.players.values()) {
        if (player.isBot) continue;
        const token = this.playerTokenMap.get(player.id);
        if (!token) continue;
        this.savedProfiles.set(token, {
          token,
          name: player.name,
          avatarColor: player.avatarColor,
          skinId: player.skinId,
          baseTheme: player.baseTheme,
          coins: Math.floor(player.coins),
          gems: Math.floor(player.gems),
          totalEarned: Math.floor(player.totalEarned),
          level: player.level,
          xp: player.xp,
          rebirths: player.rebirths,
          stealsCount: player.stealsCount,
          timesStolenFrom: player.timesStolenFrom,
          discoveredIds: player.discoveredIds,
          unlockedSkins: player.unlockedSkins,
          unlockedThemes: player.unlockedThemes,
          upgrades: player.upgrades,
          memelings: player.memelings,
          dailyStreak: player.dailyStreak,
          lastDailyClaimAt: player.lastDailyClaimAt,
          quests: player.quests,
        });
      }
      if (!fs.existsSync(SAVE_DIR)) {
        fs.mkdirSync(SAVE_DIR, { recursive: true });
      }
      const obj = Object.fromEntries(this.savedProfiles.entries());
      const tmp = `${SAVE_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf-8');
      fs.renameSync(tmp, SAVE_FILE);
    } catch {
      // Non-fatal in read-only sandboxes
    }
  }

  private seedInitialWorld(): void {
    // Spawn 4 lively rival tycoons on bases 1, 3, 5, 7 (leaving base 0, 2, 4, 6 immediately open for humans)
    const botBaseIndices = [1, 3, 5, 7];
    BOT_ROSTER.forEach((cfg, i) => {
      const baseIndex = botBaseIndices[i];
      const plot = BASE_PLOTS[baseIndex];
      const memelings: OwnedMemeling[] = cfg.starterIds.map((creatureId, slotIdx) => ({
        instanceId: uid('mem'),
        creatureId,
        mutation: slotIdx === cfg.starterIds.length - 1 && i === 1 ? 'shiny' : 'normal',
        level: 1,
        slotIndex: slotIdx,
        locked: false,
        favorite: false,
        acquiredAt: Date.now() - 60_000,
      }));

      const bot: PlayerState = {
        id: cfg.id,
        name: cfg.name,
        isBot: true,
        avatarColor: cfg.avatarColor,
        skinId: cfg.skinId,
        baseTheme: cfg.baseTheme,
        baseIndex,
        x: plot.spawnPoint.x,
        y: 0,
        z: plot.spawnPoint.z,
        yaw: plot.facingYaw,
        isMoving: false,
        isSprinting: false,
        isInvisibleUntil: 0,
        coins: 450 + i * 320,
        gems: 12,
        totalEarned: 1500 + i * 800,
        incomePerSec: 0,
        level: 2 + i,
        xp: 40,
        xpToNext: 150,
        rebirths: i === 1 ? 1 : 0,
        rebirthMultiplier: i === 1 ? 1.75 : 1,
        stealsCount: i,
        timesStolenFrom: 0,
        discoveredIds: [...cfg.starterIds],
        unlockedSkins: ['classic', cfg.skinId],
        unlockedThemes: ['theme-marble', cfg.baseTheme],
        upgrades: {
          baseSlots: 1,
          lockDuration: 0,
          speedBoots: 1,
          incomeBoost: 0,
          stealHands: 0,
          securityTurret: 0,
        },
        memelings,
        carrying: null,
        baseLockedUntil: 0,
        baseLockCooldownUntil: 0,
        dailyStreak: 1,
        lastDailyClaimAt: 0,
        skyChestCooldownUntil: 0,
        quests: createStarterQuests(),
      };
      this.recomputeIncome(bot);
      this.players.set(bot.id, bot);
      this.botBrains.set(bot.id, {
        state: 'roam',
        targetX: plot.spawnPoint.x,
        targetZ: plot.spawnPoint.z,
        nextDecisionAt: Date.now() + 2000 + i * 1200,
      });
    });

    // Seed conveyor with 6 staggered Memelings so the belt looks alive on second 1
    for (let i = 0; i < 6; i++) {
      const def = i < 3 ? CREATURES[i] : rollCreature(1.2);
      const lane = (i % 2) as 0 | 1;
      this.conveyor.push({
        id: uid('conv'),
        creatureId: def.id,
        mutation: rollMutation(1),
        lane,
        progress: 0.1 + i * 0.14,
        price: def.price,
        spawnedAt: Date.now(),
      });
    }

    this.pushChat({
      id: uid('chat'),
      senderId: 'system',
      senderName: 'Memeverse',
      text: 'Welcome to STEAL THE MEMEVERSE! Buy Memelings on the conveyor, lock your base with [L], and raid unlocked rivals!',
      timestamp: Date.now(),
      isSystem: true,
      accent: '#38bdf8',
    });
  }

  private getMaxSlots(player: PlayerState): number {
    return Math.min(12, 6 + player.upgrades.baseSlots);
  }

  private findFreeSlot(player: PlayerState): number {
    const maxSlots = this.getMaxSlots(player);
    const used = new Set(player.memelings.map((m) => m.slotIndex));
    for (let i = 0; i < maxSlots; i++) {
      if (!used.has(i)) return i;
    }
    return -1;
  }

  private recomputeIncome(player: PlayerState): void {
    const baseIncome = player.memelings.reduce(
      (sum, m) => sum + getCreatureEffectiveIncome(m.creatureId, m.mutation, m.level),
      0,
    );
    const upgradeMult = 1 + player.upgrades.incomeBoost * 0.25;
    const eventMult = this.activeEvent ? this.activeEvent.incomeMultiplier : 1;
    player.incomePerSec = Math.round(baseIncome * upgradeMult * player.rebirthMultiplier * eventMult);
  }

  private addXp(player: PlayerState, amount: number): void {
    player.xp += amount;
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level += 1;
      player.xpToNext = Math.round(100 * Math.pow(1.35, player.level - 1));
      player.gems += 3;
      if (!player.isBot) {
        this.emitPlayerAlert(player.id, {
          id: uid('alert'),
          kind: 'info',
          title: `Level ${player.level} Reached!`,
          message: '+3 Gems bonus awarded for leveling up.',
          accentColor: '#38bdf8',
          timestamp: Date.now(),
        });
      }
    }
  }

  private advanceQuest(player: PlayerState, type: PlayerState['quests'][number]['type'], delta: number): void {
    for (const q of player.quests) {
      if (q.type === type && !q.claimed) {
        if (type === 'earn') {
          q.progress = Math.min(q.target, Math.floor(player.totalEarned));
        } else {
          q.progress = Math.min(q.target, q.progress + delta);
        }
      }
    }
  }

  private allocateBaseIndex(): number {
    const used = new Set<number>();
    for (const p of this.players.values()) {
      used.add(p.baseIndex);
    }
    for (let i = 0; i < BASE_PLOTS.length; i++) {
      if (!used.has(i)) return i;
    }
    // Evict a bot if all 8 plots are occupied so real players always get a plot
    for (const p of this.players.values()) {
      if (p.isBot) {
        const idx = p.baseIndex;
        this.players.delete(p.id);
        this.botBrains.delete(p.id);
        return idx;
      }
    }
    return 0;
  }

  private checkRateLimit(socketId: string, action: string, minGapMs = 120): boolean {
    const now = Date.now();
    const key = `${socketId}:${action}`;
    const prev = this.actionRateLimits.get(key) ?? 0;
    if (now - prev < minGapMs) return false;
    this.actionRateLimits.set(key, now);
    return true;
  }

  private pushChat(msg: ChatMessage): void {
    this.chat.push(msg);
    if (this.chat.length > 40) this.chat.shift();
    this.io.emit('chat:message', msg);
  }

  private broadcastAlert(alert: WorldAlert): void {
    this.io.emit('world:alert', alert);
  }

  private emitPlayerAlert(playerId: string, alert: WorldAlert): void {
    for (const [sockId, pId] of this.socketToPlayerId.entries()) {
      if (pId === playerId) {
        this.io.to(sockId).emit('world:alert', alert);
      }
    }
  }

  public getLeaderboard(): LeaderboardEntry[] {
    return Array.from(this.players.values())
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        isBot: p.isBot,
        coins: Math.floor(p.coins),
        incomePerSec: p.incomePerSec,
        rebirths: p.rebirths,
        stealsCount: p.stealsCount,
        memelingCount: p.memelings.length,
        avatarColor: p.avatarColor,
      }))
      .sort((a, b) => b.incomePerSec - a.incomePerSec || b.coins - a.coins);
  }

  private findTradeForPlayer(playerId: string): TradeOffer | null {
    for (const t of this.trades.values()) {
      if ((t.fromPlayerId === playerId || t.toPlayerId === playerId) && (t.status === 'pending' || t.status === 'active')) {
        return t;
      }
    }
    return null;
  }

  private buildSnapshot(forPlayerId?: string): WorldSnapshot {
    return {
      serverTime: Date.now(),
      players: Array.from(this.players.values()),
      conveyor: this.conveyor,
      activeEvent: this.activeEvent,
      nextEventAt: this.nextEventAt,
      leaderboard: this.getLeaderboard(),
      chat: this.chat.slice(-25),
      activeTrade: forPlayerId ? this.findTradeForPlayer(forPlayerId) : null,
    };
  }

  private bindSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      socket.on(
        'player:join',
        (
          payload: { name?: string; token?: string; avatarColor?: string },
          ack?: (res: { ok: boolean; playerId?: string; snapshot?: WorldSnapshot; error?: string }) => void,
        ) => {
          const cleanName = sanitizeText(payload?.name, 18) || `Raider${Math.floor(100 + Math.random() * 899)}`;
          const token = sanitizeText(payload?.token, 48) || uid('tok');
          const avatarColor =
            typeof payload?.avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(payload.avatarColor)
              ? payload.avatarColor
              : '#38bdf8';

          // Disconnect stale socket if reconnecting with same token
          for (const [existingPlayerId, existingToken] of this.playerTokenMap.entries()) {
            if (existingToken === token) {
              this.players.delete(existingPlayerId);
              this.playerTokenMap.delete(existingPlayerId);
              for (const [sId, pId] of this.socketToPlayerId.entries()) {
                if (pId === existingPlayerId) this.socketToPlayerId.delete(sId);
              }
            }
          }

          const baseIndex = this.allocateBaseIndex();
          const plot = BASE_PLOTS[baseIndex];
          const saved = this.savedProfiles.get(token);

          const playerId = uid('plr');
          const starterMemeling: OwnedMemeling = {
            instanceId: uid('mem'),
            creatureId: 'bloop-cat',
            mutation: 'normal',
            level: 1,
            slotIndex: 0,
            locked: false,
            favorite: false,
            acquiredAt: Date.now(),
          };

          const player: PlayerState = saved
            ? {
                id: playerId,
                name: cleanName,
                isBot: false,
                avatarColor,
                skinId: saved.skinId || 'classic',
                baseTheme: saved.baseTheme || 'theme-marble',
                baseIndex,
                x: plot.spawnPoint.x,
                y: 0,
                z: plot.spawnPoint.z,
                yaw: plot.facingYaw,
                isMoving: false,
                isSprinting: false,
                isInvisibleUntil: 0,
                coins: Math.max(150, saved.coins),
                gems: saved.gems ?? 15,
                totalEarned: saved.totalEarned ?? 150,
                incomePerSec: 0,
                level: saved.level || 1,
                xp: saved.xp || 0,
                xpToNext: Math.round(100 * Math.pow(1.35, (saved.level || 1) - 1)),
                rebirths: saved.rebirths || 0,
                rebirthMultiplier: Number((1 + (saved.rebirths || 0) * 0.75).toFixed(2)),
                stealsCount: saved.stealsCount || 0,
                timesStolenFrom: saved.timesStolenFrom || 0,
                discoveredIds: saved.discoveredIds?.length ? saved.discoveredIds : ['bloop-cat'],
                unlockedSkins: saved.unlockedSkins?.length ? saved.unlockedSkins : ['classic'],
                unlockedThemes: saved.unlockedThemes?.length ? saved.unlockedThemes : ['theme-marble'],
                upgrades: {
                  baseSlots: saved.upgrades?.baseSlots ?? 0,
                  lockDuration: saved.upgrades?.lockDuration ?? 0,
                  speedBoots: saved.upgrades?.speedBoots ?? 0,
                  incomeBoost: saved.upgrades?.incomeBoost ?? 0,
                  stealHands: saved.upgrades?.stealHands ?? 0,
                  securityTurret: saved.upgrades?.securityTurret ?? 0,
                },
                memelings: saved.memelings?.length ? saved.memelings : [starterMemeling],
                carrying: null,
                baseLockedUntil: Date.now() + 25_000, // 25s newcomer shield
                baseLockCooldownUntil: 0,
                dailyStreak: saved.dailyStreak || 0,
                lastDailyClaimAt: saved.lastDailyClaimAt || 0,
                skyChestCooldownUntil: 0,
                quests: saved.quests?.length ? saved.quests : createStarterQuests(),
              }
            : {
                id: playerId,
                name: cleanName,
                isBot: false,
                avatarColor,
                skinId: 'classic',
                baseTheme: 'theme-marble',
                baseIndex,
                x: plot.spawnPoint.x,
                y: 0,
                z: plot.spawnPoint.z,
                yaw: plot.facingYaw,
                isMoving: false,
                isSprinting: false,
                isInvisibleUntil: 0,
                coins: 220,
                gems: 20,
                totalEarned: 220,
                incomePerSec: 0,
                level: 1,
                xp: 0,
                xpToNext: 100,
                rebirths: 0,
                rebirthMultiplier: 1,
                stealsCount: 0,
                timesStolenFrom: 0,
                discoveredIds: ['bloop-cat'],
                unlockedSkins: ['classic'],
                unlockedThemes: ['theme-marble'],
                upgrades: {
                  baseSlots: 0,
                  lockDuration: 0,
                  speedBoots: 0,
                  incomeBoost: 0,
                  stealHands: 0,
                  securityTurret: 0,
                },
                memelings: [starterMemeling],
                carrying: null,
                baseLockedUntil: Date.now() + 25_000,
                baseLockCooldownUntil: 0,
                dailyStreak: 0,
                lastDailyClaimAt: 0,
                skyChestCooldownUntil: 0,
                quests: createStarterQuests(),
              };

          this.recomputeIncome(player);
          this.players.set(playerId, player);
          this.socketToPlayerId.set(socket.id, playerId);
          this.playerTokenMap.set(playerId, token);

          this.pushChat({
            id: uid('chat'),
            senderId: 'system',
            senderName: 'Memeverse',
            text: `${player.name} joined Plot #${baseIndex + 1}!`,
            timestamp: Date.now(),
            isSystem: true,
            accent: '#4ade80',
          });

          ack?.({ ok: true, playerId, snapshot: this.buildSnapshot(playerId) });
        },
      );

      socket.on(
        'player:move',
        (payload: { x: number; y: number; z: number; yaw: number; isMoving: boolean; isSprinting: boolean }) => {
          const playerId = this.socketToPlayerId.get(socket.id);
          if (!playerId) return;
          const player = this.players.get(playerId);
          if (!player) return;

          if (
            typeof payload?.x !== 'number' ||
            typeof payload?.y !== 'number' ||
            typeof payload?.z !== 'number' ||
            !Number.isFinite(payload.x) ||
            !Number.isFinite(payload.y) ||
            !Number.isFinite(payload.z)
          ) {
            return;
          }

          // Server-side anti-teleport & boundary clamp
          const jumpDist = Math.hypot(payload.x - player.x, payload.z - player.z);
          if (jumpDist > 12) {
            // Allow smooth catch-up only up to reasonable step
            const ratio = 12 / jumpDist;
            player.x += (payload.x - player.x) * ratio;
            player.z += (payload.z - player.z) * ratio;
          } else {
            player.x = Math.max(-WORLD_RADIUS, Math.min(WORLD_RADIUS, payload.x));
            player.z = Math.max(-WORLD_RADIUS, Math.min(WORLD_RADIUS, payload.z));
          }
          player.y = Math.max(-1, Math.min(20, payload.y));
          player.yaw = Number.isFinite(payload.yaw) ? payload.yaw : player.yaw;
          player.isMoving = Boolean(payload.isMoving);
          player.isSprinting = Boolean(payload.isSprinting);

          // Prevent walking inside another player's LOCKED base
          const now = Date.now();
          for (const other of this.players.values()) {
            if (other.id === player.id) continue;
            if (other.baseLockedUntil > now) {
              const plot = BASE_PLOTS[other.baseIndex];
              const dx = player.x - plot.center.x;
              const dz = player.z - plot.center.z;
              if (Math.abs(dx) < 6.4 && Math.abs(dz) < 6.4) {
                const pushDir = plot.center.x < 0 ? 1 : -1;
                player.x = plot.center.x + pushDir * 7.2;
              }
            }
          }

          // Defense Bonk: if this player runs into someone carrying THIS player's stolen Memeling!
          for (const rival of this.players.values()) {
            if (rival.id === player.id || !rival.carrying) continue;
            if (rival.carrying.fromPlayerId === player.id) {
              if (dist2D(player.x, player.z, rival.x, rival.z) < 3.0) {
                this.recoverStolenMemeling(rival, player);
              }
            }
          }

          // Auto-deliver stolen Memeling when player reaches their own base!
          if (player.carrying) {
            const ownPlot = BASE_PLOTS[player.baseIndex];
            const distToDeposit = dist2D(player.x, player.z, ownPlot.depositPad.x, ownPlot.depositPad.z);
            const distToCenter = dist2D(player.x, player.z, ownPlot.center.x, ownPlot.center.z);
            if (distToDeposit < 3.5 || distToCenter < 6.2) {
              this.completeHeistDelivery(player);
            }
          }
        },
      );

      socket.on('player:teleportHome', (ack?: (res: { ok: boolean; x?: number; z?: number; error?: string }) => void) => {
        const player = this.getPlayerBySocket(socket.id);
        if (!player) return ack?.({ ok: false, error: 'Not joined' });
        if (player.carrying) {
          return ack?.({ ok: false, error: 'Cannot teleport while carrying a stolen Memeling! Run home!' });
        }
        const plot = BASE_PLOTS[player.baseIndex];
        player.x = plot.spawnPoint.x;
        player.y = 0;
        player.z = plot.spawnPoint.z;
        player.yaw = plot.facingYaw;
        ack?.({ ok: true, x: player.x, z: player.z });
      });

      socket.on(
        'conveyor:buy',
        (payload: { itemId: string }, ack?: (res: { ok: boolean; creatureId?: string; error?: string }) => void) => {
          if (!this.checkRateLimit(socket.id, 'buy', 100)) return ack?.({ ok: false, error: 'Too fast' });
          const player = this.getPlayerBySocket(socket.id);
          if (!player) return ack?.({ ok: false, error: 'Not joined' });

          const idx = this.conveyor.findIndex((c) => c.id === payload?.itemId);
          if (idx === -1) return ack?.({ ok: false, error: 'Memeling already bought or left the belt.' });

          const item = this.conveyor[idx];
          const pos = getConveyorWorldPosition(item.lane, item.progress);
          if (dist2D(player.x, player.z, pos.x, pos.z) > 10.5) {
            return ack?.({ ok: false, error: 'Move closer to the conveyor belt to buy!' });
          }

          const freeSlot = this.findFreeSlot(player);
          if (freeSlot === -1) {
            return ack?.({ ok: false, error: 'Your base pedestals are full! Expand slots in the Shop or sell one.' });
          }

          if (player.coins < item.price) {
            return ack?.({ ok: false, error: `Need ${item.price.toLocaleString()} Coins.` });
          }

          // Atomic server purchase
          player.coins -= item.price;
          this.conveyor.splice(idx, 1);

          const owned: OwnedMemeling = {
            instanceId: uid('mem'),
            creatureId: item.creatureId,
            mutation: item.mutation,
            level: 1,
            slotIndex: freeSlot,
            locked: false,
            favorite: false,
            acquiredAt: Date.now(),
          };
          player.memelings.push(owned);
          if (!player.discoveredIds.includes(item.creatureId)) {
            player.discoveredIds.push(item.creatureId);
          }

          const def = CREATURE_BY_ID[item.creatureId];
          this.recomputeIncome(player);
          this.addXp(player, 18 + (RARITY_META[def?.rarity ?? 'Common']?.order ?? 1) * 12);
          this.advanceQuest(player, 'buy', 1);

          ack?.({ ok: true, creatureId: item.creatureId });
        },
      );

      socket.on(
        'base:steal',
        (
          payload: { targetPlayerId: string; instanceId: string },
          ack?: (res: { ok: boolean; error?: string }) => void,
        ) => {
          if (!this.checkRateLimit(socket.id, 'steal', 250)) return ack?.({ ok: false, error: 'Too fast' });
          const thief = this.getPlayerBySocket(socket.id);
          if (!thief) return ack?.({ ok: false, error: 'Not joined' });
          if (thief.carrying) return ack?.({ ok: false, error: 'Already carrying a stolen Memeling! Deliver it home first.' });

          const freeSlot = this.findFreeSlot(thief);
          if (freeSlot === -1) {
            return ack?.({ ok: false, error: 'Your base has no open pedestals! Free up a slot first.' });
          }

          const victim = this.players.get(payload?.targetPlayerId);
          if (!victim || victim.id === thief.id) {
            return ack?.({ ok: false, error: 'Invalid target base.' });
          }

          const now = Date.now();
          if (victim.baseLockedUntil > now) {
            const left = Math.ceil((victim.baseLockedUntil - now) / 1000);
            return ack?.({ ok: false, error: `${victim.name}'s base is shielded for ${left}s!` });
          }

          const memIdx = victim.memelings.findIndex((m) => m.instanceId === payload?.instanceId);
          if (memIdx === -1) {
            return ack?.({ ok: false, error: 'Memeling is no longer on that pedestal.' });
          }

          const targetMem = victim.memelings[memIdx];
          const plot = BASE_PLOTS[victim.baseIndex];
          const ped = plot.pedestals[targetMem.slotIndex] ?? plot.center;
          const maxStealRange = 6.2 + thief.upgrades.stealHands * 0.6;
          if (dist2D(thief.x, thief.z, ped.x, ped.z) > maxStealRange) {
            return ack?.({ ok: false, error: 'Get closer to the pedestal to snatch it!' });
          }

          // Atomic removal from victim -> placed into thief.carrying (impossible to duplicate!)
          victim.memelings.splice(memIdx, 1);
          this.recomputeIncome(victim);

          thief.carrying = {
            instanceId: targetMem.instanceId,
            creatureId: targetMem.creatureId,
            mutation: targetMem.mutation,
            level: targetMem.level,
            fromBaseIndex: victim.baseIndex,
            fromPlayerId: victim.id,
            fromPlayerName: victim.name,
            stolenAt: now,
          };

          const def = CREATURE_BY_ID[targetMem.creatureId];
          this.emitPlayerAlert(victim.id, {
            id: uid('alert'),
            kind: 'theft',
            title: 'BASE RAID ALERT!',
            message: `${thief.name} snatched your ${def?.name ?? 'Memeling'}! Chase and touch them to recover it!`,
            accentColor: '#f43f5e',
            timestamp: now,
          });

          this.emitPlayerAlert(thief.id, {
            id: uid('alert'),
            kind: 'theft',
            title: `Snatched ${def?.name ?? 'Memeling'}!`,
            message: 'Sprint back to your base Deposit Pad to keep it!',
            accentColor: '#fbbf24',
            timestamp: now,
          });

          ack?.({ ok: true });
        },
      );

      socket.on('base:drop', (ack?: (res: { ok: boolean }) => void) => {
        const player = this.getPlayerBySocket(socket.id);
        if (!player || !player.carrying) return ack?.({ ok: false });
        const victim = this.players.get(player.carrying.fromPlayerId);
        if (victim) {
          this.recoverStolenMemeling(player, victim, false);
        } else {
          player.carrying = null;
        }
        ack?.({ ok: true });
      });

      socket.on('base:lock', (ack?: (res: { ok: boolean; durationSec?: number; error?: string }) => void) => {
        const player = this.getPlayerBySocket(socket.id);
        if (!player) return ack?.({ ok: false, error: 'Not joined' });
        const now = Date.now();
        if (player.baseLockedUntil > now) {
          return ack?.({ ok: false, error: 'Your laser shield is already active!' });
        }
        if (player.baseLockCooldownUntil > now) {
          const left = Math.ceil((player.baseLockCooldownUntil - now) / 1000);
          return ack?.({ ok: false, error: `Shield recharging (${left}s left).` });
        }

        const durationMs = BASE_LOCK_BASE_DURATION_MS + player.upgrades.lockDuration * 10_000;
        player.baseLockedUntil = now + durationMs;
        player.baseLockCooldownUntil = now + durationMs + BASE_LOCK_COOLDOWN_MS;
        this.advanceQuest(player, 'lock', 1);

        // Eject any rival currently inside this base
        const plot = BASE_PLOTS[player.baseIndex];
        for (const other of this.players.values()) {
          if (other.id === player.id) continue;
          if (Math.abs(other.x - plot.center.x) < 6.5 && Math.abs(other.z - plot.center.z) < 6.5) {
            const pushDir = plot.center.x < 0 ? 1 : -1;
            other.x = plot.center.x + pushDir * 8.0;
          }
        }

        ack?.({ ok: true, durationSec: Math.round(durationMs / 1000) });
      });

      socket.on(
        'memeling:sell',
        (payload: { instanceId: string }, ack?: (res: { ok: boolean; earned?: number; error?: string }) => void) => {
          const player = this.getPlayerBySocket(socket.id);
          if (!player) return ack?.({ ok: false, error: 'Not joined' });
          const idx = player.memelings.findIndex((m) => m.instanceId === payload?.instanceId);
          if (idx === -1) return ack?.({ ok: false, error: 'Memeling not found.' });
          const mem = player.memelings[idx];
          if (mem.locked) return ack?.({ ok: false, error: 'Unlock this Memeling first before selling.' });

          const earned = getCreatureSellValue(mem.creatureId, mem.mutation, mem.level);
          player.memelings.splice(idx, 1);
          player.coins += earned;
          player.totalEarned += earned;
          this.recomputeIncome(player);
          ack?.({ ok: true, earned });
        },
      );

      socket.on(
        'memeling:toggleLock',
        (payload: { instanceId: string }, ack?: (res: { ok: boolean }) => void) => {
          const player = this.getPlayerBySocket(socket.id);
          if (!player) return ack?.({ ok: false });
          const mem = player.memelings.find((m) => m.instanceId === payload?.instanceId);
          if (!mem) return ack?.({ ok: false });
          mem.locked = !mem.locked;
          ack?.({ ok: true });
        },
      );

      socket.on(
        'memeling:toggleFavorite',
        (payload: { instanceId: string }, ack?: (res: { ok: boolean }) => void) => {
          const player = this.getPlayerBySocket(socket.id);
          if (!player) return ack?.({ ok: false });
          const mem = player.memelings.find((m) => m.instanceId === payload?.instanceId);
          if (!mem) return ack?.({ ok: false });
          mem.favorite = !mem.favorite;
          ack?.({ ok: true });
        },
      );

      socket.on(
        'memeling:fuse',
        (payload: { instanceId: string }, ack?: (res: { ok: boolean; newLevel?: number; error?: string }) => void) => {
          const player = this.getPlayerBySocket(socket.id);
          if (!player) return ack?.({ ok: false, error: 'Not joined' });
          const primary = player.memelings.find((m) => m.instanceId === payload?.instanceId);
          if (!primary) return ack?.({ ok: false, error: 'Memeling not found.' });
          const donorIdx = player.memelings.findIndex(
            (m) => m.instanceId !== primary.instanceId && m.creatureId === primary.creatureId && !m.locked,
          );
          if (donorIdx === -1) {
            return ack?.({ ok: false, error: 'Need another unlocked duplicate of this Memeling to fuse!' });
          }

          player.memelings.splice(donorIdx, 1);
          primary.level += 1;
          this.recomputeIncome(player);
          this.addXp(player, 45);
          ack?.({ ok: true, newLevel: primary.level });
        },
      );

      socket.on(
        'shop:upgrade',
        (payload: { key: keyof PlayerUpgrades }, ack?: (res: { ok: boolean; error?: string }) => void) => {
          const player = this.getPlayerBySocket(socket.id);
          if (!player) return ack?.({ ok: false, error: 'Not joined' });
          const spec = UPGRADE_CATALOG.find((u) => u.key === payload?.key);
          if (!spec) return ack?.({ ok: false, error: 'Unknown upgrade.' });

          const currentLevel = player.upgrades[spec.key];
          if (currentLevel >= spec.maxLevel) {
            return ack?.({ ok: false, error: 'Already at maximum level!' });
          }
          const cost = getUpgradeCost(spec.key, currentLevel);
          if (player.coins < cost) {
            return ack?.({ ok: false, error: `Need ${cost.toLocaleString()} Coins.` });
          }

          player.coins -= cost;
          player.upgrades[spec.key] = currentLevel + 1;
          this.recomputeIncome(player);
          this.addXp(player, 35);
          ack?.({ ok: true });
        },
      );

      socket.on(
        'shop:cosmetic',
        (payload: { cosmeticId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
          const player = this.getPlayerBySocket(socket.id);
          if (!player) return ack?.({ ok: false, error: 'Not joined' });
          const item = COSMETIC_CATALOG.find((c) => c.id === payload?.cosmeticId);
          if (!item) return ack?.({ ok: false, error: 'Item not found.' });

          const list = item.category === 'skin' ? player.unlockedSkins : player.unlockedThemes;
          if (!list.includes(item.id)) {
            if (player.gems < item.gemCost) {
              return ack?.({ ok: false, error: `Need ${item.gemCost} Gems.` });
            }
            player.gems -= item.gemCost;
            list.push(item.id);
          }

          if (item.category === 'skin') {
            player.skinId = item.id;
            player.avatarColor = item.color;
          } else {
            player.baseTheme = item.id;
          }
          ack?.({ ok: true });
        },
      );

      socket.on('shop:cloak', (ack?: (res: { ok: boolean; error?: string }) => void) => {
        const player = this.getPlayerBySocket(socket.id);
        if (!player) return ack?.({ ok: false, error: 'Not joined' });
        if (player.gems < SNEAK_CLOAK_COST_GEMS) {
          return ack?.({ ok: false, error: `Need ${SNEAK_CLOAK_COST_GEMS} Gems.` });
        }
        player.gems -= SNEAK_CLOAK_COST_GEMS;
        player.isInvisibleUntil = Date.now() + SNEAK_CLOAK_DURATION_MS;
        ack?.({ ok: true });
      });

      socket.on('player:rebirth', (ack?: (res: { ok: boolean; error?: string }) => void) => {
        const player = this.getPlayerBySocket(socket.id);
        if (!player) return ack?.({ ok: false, error: 'Not joined' });
        const req = getRebirthRequirement(player.rebirths);
        if (player.coins < req.coinCost) {
          return ack?.({ ok: false, error: `Need ${req.coinCost.toLocaleString()} Coins to Rebirth.` });
        }

        player.rebirths += 1;
        player.rebirthMultiplier = req.nextMultiplier;
        player.coins = 250 * player.rebirths;
        player.gems += req.gemReward;
        player.carrying = null;
        // Keep favorite/locked Memeling if any? Keep 1 highest-rarity Memeling as heirloom + reset rest!
        const heirloom = [...player.memelings].sort(
          (a, b) =>
            (RARITY_META[CREATURE_BY_ID[b.creatureId]?.rarity ?? 'Common']?.order ?? 0) -
            (RARITY_META[CREATURE_BY_ID[a.creatureId]?.rarity ?? 'Common']?.order ?? 0),
        )[0];

        player.memelings = heirloom
          ? [{ ...heirloom, slotIndex: 0 }]
          : [
              {
                instanceId: uid('mem'),
                creatureId: 'bloop-cat',
                mutation: 'shiny',
                level: 1,
                slotIndex: 0,
                locked: false,
                favorite: false,
                acquiredAt: Date.now(),
              },
            ];

        this.recomputeIncome(player);
        this.addXp(player, 250);

        this.broadcastAlert({
          id: uid('alert'),
          kind: 'rebirth',
          title: `REBIRTH ${player.rebirths}!`,
          message: `${player.name} ascended to ${player.rebirthMultiplier}x permanent income!`,
          accentColor: '#fbbf24',
          timestamp: Date.now(),
        });

        ack?.({ ok: true });
      });

      socket.on(
        'lucky:open',
        (
          payload: { tier: 'basic' | 'epic' | 'celestial' },
          ack?: (res: { ok: boolean; result?: LuckyBlockResult; error?: string }) => void,
        ) => {
          if (!this.checkRateLimit(socket.id, 'lucky', 350)) return ack?.({ ok: false, error: 'Slow down!' });
          const player = this.getPlayerBySocket(socket.id);
          if (!player) return ack?.({ ok: false, error: 'Not joined' });
          const tierKey = payload?.tier;
          const spec = LUCKY_BLOCK_TIERS[tierKey];
          if (!spec) return ack?.({ ok: false, error: 'Invalid lucky block tier.' });

          if (spec.costCoins > 0 && player.coins < spec.costCoins) {
            return ack?.({ ok: false, error: `Need ${spec.costCoins.toLocaleString()} Coins.` });
          }
          if (spec.costGems > 0 && player.gems < spec.costGems) {
            return ack?.({ ok: false, error: `Need ${spec.costGems} Gems.` });
          }

          player.coins -= spec.costCoins;
          player.gems -= spec.costGems;

          const eventLuck = this.activeEvent ? this.activeEvent.luckMultiplier : 1;
          const creature = rollCreature(spec.luckMultiplier * eventLuck);
          const mutation = rollMutation(spec.luckMultiplier * 0.65, spec.forceMutation);
          const freeSlot = this.findFreeSlot(player);
          let bonusCoins = Math.round(creature.price * 0.25);
          let addedToBase = false;

          if (freeSlot !== -1) {
            player.memelings.push({
              instanceId: uid('mem'),
              creatureId: creature.id,
              mutation,
              level: 1,
              slotIndex: freeSlot,
              locked: false,
              favorite: false,
              acquiredAt: Date.now(),
            });
            addedToBase = true;
            if (!player.discoveredIds.includes(creature.id)) {
              player.discoveredIds.push(creature.id);
            }
          } else {
            // Base full -> pay full sell value as instant coins
            bonusCoins = getCreatureSellValue(creature.id, mutation, 1);
          }

          player.coins += bonusCoins;
          player.totalEarned += bonusCoins;
          this.recomputeIncome(player);
          this.advanceQuest(player, 'lucky', 1);
          this.addXp(player, 40);

          if (RARITY_META[creature.rarity].announceGlobal) {
            this.broadcastAlert({
              id: uid('alert'),
              kind: 'rare_spawn',
              title: `${creature.rarity.toUpperCase()} LUCKY DROP!`,
              message: `${player.name} unboxed a ${mutation !== 'normal' ? MUTATION_META[mutation].label + ' ' : ''}${creature.name}!`,
              accentColor: RARITY_META[creature.rarity].color,
              timestamp: Date.now(),
            });
          }

          ack?.({
            ok: true,
            result: {
              tier: tierKey,
              creatureId: creature.id,
              mutation,
              bonusCoins,
              addedToBase,
            },
          });
        },
      );

      socket.on(
        'quest:claim',
        (payload: { questId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
          const player = this.getPlayerBySocket(socket.id);
          if (!player) return ack?.({ ok: false, error: 'Not joined' });
          const q = player.quests.find((item) => item.id === payload?.questId);
          if (!q) return ack?.({ ok: false, error: 'Quest not found.' });
          if (q.claimed) return ack?.({ ok: false, error: 'Already claimed.' });
          if (q.progress < q.target) return ack?.({ ok: false, error: 'Quest not complete yet.' });

          q.claimed = true;
          player.coins += q.rewardCoins;
          player.totalEarned += q.rewardCoins;
          player.gems += q.rewardGems;
          this.addXp(player, 55);
          ack?.({ ok: true });
        },
      );

      socket.on('daily:claim', (ack?: (res: { ok: boolean; coins?: number; gems?: number; error?: string }) => void) => {
        const player = this.getPlayerBySocket(socket.id);
        if (!player) return ack?.({ ok: false, error: 'Not joined' });
        const now = Date.now();
        const cooldownMs = 20 * 60 * 60 * 1000;
        if (player.lastDailyClaimAt > 0 && now - player.lastDailyClaimAt < cooldownMs) {
          const hrs = Math.ceil((cooldownMs - (now - player.lastDailyClaimAt)) / 3_600_000);
          return ack?.({ ok: false, error: `Next daily reward ready in ${hrs}h.` });
        }

        player.dailyStreak = (player.dailyStreak % 7) + 1;
        player.lastDailyClaimAt = now;
        const coins = 500 * player.dailyStreak * Math.max(1, player.rebirths + 1);
        const gems = 8 + player.dailyStreak * 3;
        player.coins += coins;
        player.totalEarned += coins;
        player.gems += gems;
        ack?.({ ok: true, coins, gems });
      });

      socket.on('chest:claim', (ack?: (res: { ok: boolean; coins?: number; gems?: number; error?: string }) => void) => {
        const player = this.getPlayerBySocket(socket.id);
        if (!player) return ack?.({ ok: false, error: 'Not joined' });
        const now = Date.now();
        if (player.skyChestCooldownUntil > now) {
          const left = Math.ceil((player.skyChestCooldownUntil - now) / 1000);
          return ack?.({ ok: false, error: `Sky Chest respawns in ${left}s.` });
        }
        const d = Math.hypot(
          player.x - LANDMARKS.skyChest.x,
          player.y - LANDMARKS.skyChest.y,
          player.z - LANDMARKS.skyChest.z,
        );
        if (d > 6.5) {
          return ack?.({ ok: false, error: 'Climb the Sky Obby pads to reach the Treasure Chest!' });
        }

        player.skyChestCooldownUntil = now + SKY_CHEST_COOLDOWN_MS;
        const coins = Math.max(800, Math.round(player.incomePerSec * 25));
        const gems = 8;
        player.coins += coins;
        player.totalEarned += coins;
        player.gems += gems;
        this.addXp(player, 60);
        ack?.({ ok: true, coins, gems });
      });

      // ================= PLAYER-TO-PLAYER TRADING =================
      socket.on(
        'trade:request',
        (payload: { targetPlayerId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
          const from = this.getPlayerBySocket(socket.id);
          const to = this.players.get(payload?.targetPlayerId);
          if (!from || !to || from.id === to.id) return ack?.({ ok: false, error: 'Invalid player.' });
          if (to.isBot) return ack?.({ ok: false, error: 'Rival bots do not trade — raid their bases instead!' });
          if (this.findTradeForPlayer(from.id) || this.findTradeForPlayer(to.id)) {
            return ack?.({ ok: false, error: 'One of you is already in a trade.' });
          }

          const trade: TradeOffer = {
            id: uid('trd'),
            fromPlayerId: from.id,
            fromPlayerName: from.name,
            toPlayerId: to.id,
            toPlayerName: to.name,
            fromInstanceIds: [],
            toInstanceIds: [],
            fromReady: false,
            toReady: false,
            status: 'pending',
          };
          this.trades.set(trade.id, trade);
          this.emitPlayerAlert(to.id, {
            id: uid('alert'),
            kind: 'info',
            title: 'Trade Request',
            message: `${from.name} wants to trade Memelings! Open Trade to respond.`,
            accentColor: '#38bdf8',
            timestamp: Date.now(),
          });
          ack?.({ ok: true });
        },
      );

      socket.on('trade:accept', (payload: { tradeId: string }, ack?: (res: { ok: boolean }) => void) => {
        const player = this.getPlayerBySocket(socket.id);
        const trade = this.trades.get(payload?.tradeId);
        if (!player || !trade || trade.toPlayerId !== player.id || trade.status !== 'pending') {
          return ack?.({ ok: false });
        }
        trade.status = 'active';
        ack?.({ ok: true });
      });

      socket.on(
        'trade:toggleItem',
        (payload: { tradeId: string; instanceId: string }, ack?: (res: { ok: boolean }) => void) => {
          const player = this.getPlayerBySocket(socket.id);
          const trade = this.trades.get(payload?.tradeId);
          if (!player || !trade || trade.status !== 'active') return ack?.({ ok: false });
          const owns = player.memelings.some((m) => m.instanceId === payload.instanceId && !m.locked);
          if (!owns) return ack?.({ ok: false });

          const arr = trade.fromPlayerId === player.id ? trade.fromInstanceIds : trade.toInstanceIds;
          const existing = arr.indexOf(payload.instanceId);
          if (existing >= 0) arr.splice(existing, 1);
          else if (arr.length < 4) arr.push(payload.instanceId);

          trade.fromReady = false;
          trade.toReady = false;
          ack?.({ ok: true });
        },
      );

      socket.on(
        'trade:ready',
        (payload: { tradeId: string }, ack?: (res: { ok: boolean; completed?: boolean; error?: string }) => void) => {
          const player = this.getPlayerBySocket(socket.id);
          const trade = this.trades.get(payload?.tradeId);
          if (!player || !trade || trade.status !== 'active') return ack?.({ ok: false });
          if (trade.fromPlayerId === player.id) trade.fromReady = !trade.fromReady;
          else if (trade.toPlayerId === player.id) trade.toReady = !trade.toReady;
          else return ack?.({ ok: false });

          if (trade.fromReady && trade.toReady) {
            const pA = this.players.get(trade.fromPlayerId);
            const pB = this.players.get(trade.toPlayerId);
            if (!pA || !pB) {
              trade.status = 'cancelled';
              return ack?.({ ok: false, error: 'Partner disconnected.' });
            }

            const aItems = trade.fromInstanceIds
              .map((id) => pA.memelings.find((m) => m.instanceId === id && !m.locked))
              .filter(Boolean) as OwnedMemeling[];
            const bItems = trade.toInstanceIds
              .map((id) => pB.memelings.find((m) => m.instanceId === id && !m.locked))
              .filter(Boolean) as OwnedMemeling[];

            if (aItems.length !== trade.fromInstanceIds.length || bItems.length !== trade.toInstanceIds.length) {
              trade.status = 'cancelled';
              return ack?.({ ok: false, error: 'Trade validation failed.' });
            }

            // Capacity check
            if (
              pA.memelings.length - aItems.length + bItems.length > this.getMaxSlots(pA) ||
              pB.memelings.length - bItems.length + aItems.length > this.getMaxSlots(pB)
            ) {
              trade.fromReady = false;
              trade.toReady = false;
              return ack?.({ ok: false, error: 'Not enough open base pedestals for this trade.' });
            }

            // Atomic swap
            pA.memelings = pA.memelings.filter((m) => !trade.fromInstanceIds.includes(m.instanceId));
            pB.memelings = pB.memelings.filter((m) => !trade.toInstanceIds.includes(m.instanceId));

            for (const item of bItems) {
              const slot = this.findFreeSlot(pA);
              pA.memelings.push({ ...item, slotIndex: slot });
              if (!pA.discoveredIds.includes(item.creatureId)) pA.discoveredIds.push(item.creatureId);
            }
            for (const item of aItems) {
              const slot = this.findFreeSlot(pB);
              pB.memelings.push({ ...item, slotIndex: slot });
              if (!pB.discoveredIds.includes(item.creatureId)) pB.discoveredIds.push(item.creatureId);
            }

            this.recomputeIncome(pA);
            this.recomputeIncome(pB);
            trade.status = 'completed';
            this.trades.delete(trade.id);
            return ack?.({ ok: true, completed: true });
          }

          ack?.({ ok: true, completed: false });
        },
      );

      socket.on('trade:cancel', (payload: { tradeId: string }, ack?: (res: { ok: boolean }) => void) => {
        const player = this.getPlayerBySocket(socket.id);
        const trade = this.trades.get(payload?.tradeId);
        if (!player || !trade) return ack?.({ ok: false });
        if (trade.fromPlayerId === player.id || trade.toPlayerId === player.id) {
          trade.status = 'cancelled';
          this.trades.delete(trade.id);
          ack?.({ ok: true });
        }
      });

      socket.on('chat:send', (payload: { text: string }, ack?: (res: { ok: boolean }) => void) => {
        if (!this.checkRateLimit(socket.id, 'chat', 600)) return ack?.({ ok: false });
        const player = this.getPlayerBySocket(socket.id);
        if (!player) return ack?.({ ok: false });
        const clean = sanitizeText(payload?.text, 140);
        if (!clean) return ack?.({ ok: false });
        this.pushChat({
          id: uid('chat'),
          senderId: player.id,
          senderName: player.name,
          text: clean,
          timestamp: Date.now(),
          accent: player.avatarColor,
        });
        ack?.({ ok: true });
      });

      socket.on('disconnect', () => {
        const playerId = this.socketToPlayerId.get(socket.id);
        if (!playerId) return;
        this.socketToPlayerId.delete(socket.id);
        const player = this.players.get(playerId);
        if (player) {
          // If player disconnects while carrying a stolen creature, return it safely to owner!
          if (player.carrying) {
            const victim = this.players.get(player.carrying.fromPlayerId);
            if (victim) this.recoverStolenMemeling(player, victim, false);
          }
          this.savePersistence();
          this.players.delete(playerId);
          this.playerTokenMap.delete(playerId);
        }
      });
    });
  }

  private getPlayerBySocket(socketId: string): PlayerState | undefined {
    const id = this.socketToPlayerId.get(socketId);
    if (!id) return undefined;
    return this.players.get(id);
  }

  private recoverStolenMemeling(thief: PlayerState, owner: PlayerState, announceBonk = true): void {
    const carried = thief.carrying;
    if (!carried) return;
    thief.carrying = null;

    const freeSlot = this.findFreeSlot(owner);
    if (freeSlot !== -1) {
      owner.memelings.push({
        instanceId: carried.instanceId,
        creatureId: carried.creatureId,
        mutation: carried.mutation,
        level: carried.level,
        slotIndex: freeSlot,
        locked: false,
        favorite: false,
        acquiredAt: Date.now(),
      });
      this.recomputeIncome(owner);
    }

    if (announceBonk) {
      const def = CREATURE_BY_ID[carried.creatureId];
      this.emitPlayerAlert(owner.id, {
        id: uid('alert'),
        kind: 'heist_success',
        title: 'THIEF STOPPED!',
        message: `You bonked ${thief.name} and recovered your ${def?.name ?? 'Memeling'}!`,
        accentColor: '#22c55e',
        timestamp: Date.now(),
      });
      this.emitPlayerAlert(thief.id, {
        id: uid('alert'),
        kind: 'error',
        title: 'CAUGHT RED-HANDED!',
        message: `${owner.name} tagged you and took back their ${def?.name ?? 'Memeling'}!`,
        accentColor: '#f43f5e',
        timestamp: Date.now(),
      });
    }
  }

  private completeHeistDelivery(thief: PlayerState): void {
    const carried = thief.carrying;
    if (!carried) return;

    const freeSlot = this.findFreeSlot(thief);
    if (freeSlot === -1) {
      this.emitPlayerAlert(thief.id, {
        id: uid('alert'),
        kind: 'error',
        title: 'Base Full!',
        message: 'Sell a Memeling or buy Base Pedestal Expansion to deposit your stolen loot!',
        accentColor: '#f43f5e',
        timestamp: Date.now(),
      });
      return;
    }

    thief.carrying = null;
    thief.memelings.push({
      instanceId: carried.instanceId,
      creatureId: carried.creatureId,
      mutation: carried.mutation,
      level: carried.level,
      slotIndex: freeSlot,
      locked: false,
      favorite: false,
      acquiredAt: Date.now(),
      stolenFrom: carried.fromPlayerName,
    });
    if (!thief.discoveredIds.includes(carried.creatureId)) {
      thief.discoveredIds.push(carried.creatureId);
    }

    const def = CREATURE_BY_ID[carried.creatureId];
    const heistBonus = Math.round((def?.stealValue ?? 50) * 0.4);
    thief.coins += heistBonus;
    thief.totalEarned += heistBonus;
    thief.stealsCount += 1;

    const victim = this.players.get(carried.fromPlayerId);
    if (victim) victim.timesStolenFrom += 1;

    this.recomputeIncome(thief);
    this.addXp(thief, 65);
    this.advanceQuest(thief, 'steal', 1);

    this.broadcastAlert({
      id: uid('alert'),
      kind: 'heist_success',
      title: 'HEIST COMPLETE!',
      message: `${thief.name} stole ${def?.name ?? 'a Memeling'} from ${carried.fromPlayerName}!`,
      accentColor: '#fbbf24',
      timestamp: Date.now(),
    });
  }

  private startLoops(): void {
    // 100ms authoritative simulation tick
    this.tickTimer = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.25, (now - this.lastTickAt) / 1000);
      this.lastTickAt = now;
      this.stepSimulation(dt, now);
    }, 100);

    // 100ms state broadcast (10Hz snapshot sync; client smoothly interpolates positions at 60fps!)
    this.broadcastTimer = setInterval(() => {
      const baseSnap = this.buildSnapshot();
      for (const [sockId, playerId] of this.socketToPlayerId.entries()) {
        const activeTrade = this.findTradeForPlayer(playerId);
        this.io.to(sockId).emit('world:state', activeTrade ? { ...baseSnap, activeTrade } : baseSnap);
      }
    }, 100);
  }

  private stepSimulation(dt: number, now: number): void {
    // 1. World Events lifecycle
    if (this.activeEvent && now >= this.activeEvent.endsAt) {
      this.activeEvent = null;
      this.nextEventAt = now + 55_000;
      for (const p of this.players.values()) this.recomputeIncome(p);
    } else if (!this.activeEvent && now >= this.nextEventAt) {
      const evt = WORLD_EVENTS_CATALOG[Math.floor(Math.random() * WORLD_EVENTS_CATALOG.length)];
      this.activeEvent = {
        type: evt.type,
        name: evt.name,
        description: evt.description,
        startedAt: now,
        endsAt: now + evt.durationMs,
        incomeMultiplier: evt.incomeMultiplier,
        luckMultiplier: evt.luckMultiplier,
        accentHex: evt.accentHex,
      };
      for (const p of this.players.values()) this.recomputeIncome(p);
      this.broadcastAlert({
        id: uid('alert'),
        kind: 'event',
        title: `WORLD EVENT: ${evt.name.toUpperCase()}`,
        message: evt.description,
        accentColor: evt.accentHex,
        timestamp: now,
      });
    }

    // 2. Passive income tick for all players
    for (const p of this.players.values()) {
      const earned = p.incomePerSec * dt;
      if (earned > 0) {
        p.coins += earned;
        p.totalEarned += earned;
        if (!p.isBot) this.advanceQuest(p, 'earn', earned);
      }
    }

    // 3. Conveyor movement & spawning
    const conveyorSpeed = 0.045; // full traverse in ~22 seconds
    for (let i = this.conveyor.length - 1; i >= 0; i--) {
      this.conveyor[i].progress += conveyorSpeed * dt;
      if (this.conveyor[i].progress >= 1.0) {
        this.conveyor.splice(i, 1);
      }
    }

    if (now - this.lastConveyorSpawnAt >= 2600 && this.conveyor.length < 10) {
      this.lastConveyorSpawnAt = now;
      const luckMult = this.activeEvent ? this.activeEvent.luckMultiplier : 1;
      const def = rollCreature(luckMult);
      const mutation = rollMutation(luckMult);
      const lane = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
      // Ensure no overlap right at intake
      const tooClose = this.conveyor.some((c) => c.lane === lane && c.progress < 0.14);
      if (!tooClose) {
        const mutMult = MUTATION_META[mutation].multiplier;
        const price = Math.round(def.price * (mutation === 'normal' ? 1 : 0.8 + mutMult * 0.45));
        this.conveyor.push({
          id: uid('conv'),
          creatureId: def.id,
          mutation,
          lane,
          progress: 0.02,
          price,
          spawnedAt: now,
        });

        if (RARITY_META[def.rarity].announceGlobal || mutation === 'rainbow' || mutation === 'cosmic') {
          this.broadcastAlert({
            id: uid('alert'),
            kind: 'rare_spawn',
            title: `${def.rarity.toUpperCase()} ON CONVEYOR!`,
            message: `${mutation !== 'normal' ? MUTATION_META[mutation].label + ' ' : ''}${def.name} just rolled onto Lane ${lane + 1}!`,
            accentColor: RARITY_META[def.rarity].color,
            timestamp: now,
          });
        }
      }
    }

    // 4. Server-authoritative Rival Bot behavior
    this.stepBots(dt, now);

    // 5. Periodic persistence flush
    if (now - this.lastSaveAt > 15_000) {
      this.lastSaveAt = now;
      this.savePersistence();
    }
  }

  private stepBots(dt: number, now: number): void {
    for (const bot of this.players.values()) {
      if (!bot.isBot) continue;
      const brain = this.botBrains.get(bot.id);
      if (!brain) continue;

      const ownPlot = BASE_PLOTS[bot.baseIndex];

      // Occasionally lock base when cooldown is ready (35% chance)
      if (bot.baseLockedUntil < now && bot.baseLockCooldownUntil < now && Math.random() < 0.004) {
        bot.baseLockedUntil = now + 22_000;
        bot.baseLockCooldownUntil = now + 52_000;
      }

      // If bot has less than 2 creatures, keep it stocked so players always have fun targets!
      if (bot.memelings.length < 2 && now > brain.nextDecisionAt) {
        const slot = this.findFreeSlot(bot);
        if (slot !== -1) {
          const def = rollCreature(1.1);
          bot.memelings.push({
            instanceId: uid('mem'),
            creatureId: def.id,
            mutation: rollMutation(1),
            level: 1,
            slotIndex: slot,
            locked: false,
            favorite: false,
            acquiredAt: now,
          });
          this.recomputeIncome(bot);
        }
      }

      // Decide next goal
      if (now >= brain.nextDecisionAt && !bot.carrying) {
        const affordable = this.conveyor.find((c) => c.price <= bot.coins && c.progress > 0.15 && c.progress < 0.8);
        if (affordable && this.findFreeSlot(bot) !== -1 && Math.random() < 0.65) {
          const pos = getConveyorWorldPosition(affordable.lane, affordable.progress);
          brain.state = 'buy';
          brain.targetConveyorId = affordable.id;
          brain.targetX = pos.x + (affordable.lane === 0 ? -2.8 : 2.8);
          brain.targetZ = pos.z;
          brain.nextDecisionAt = now + 6000;
        } else if (Math.random() < 0.22 && this.findFreeSlot(bot) !== -1) {
          // Attempt a cheeky raid on a random unlocked base!
          const unlockedVictims = Array.from(this.players.values()).filter(
            (p) => p.id !== bot.id && p.baseLockedUntil < now && p.memelings.length > 1,
          );
          if (unlockedVictims.length > 0) {
            const victim = unlockedVictims[Math.floor(Math.random() * unlockedVictims.length)];
            const vPlot = BASE_PLOTS[victim.baseIndex];
            brain.state = 'raid';
            brain.targetBaseIndex = victim.baseIndex;
            brain.targetX = vPlot.center.x;
            brain.targetZ = vPlot.center.z;
            brain.nextDecisionAt = now + 9000;
          } else {
            brain.state = 'roam';
            brain.targetX = ownPlot.spawnPoint.x + (Math.random() - 0.5) * 8;
            brain.targetZ = ownPlot.spawnPoint.z + (Math.random() - 0.5) * 8;
            brain.nextDecisionAt = now + 4500;
          }
        } else {
          brain.state = 'roam';
          brain.targetX = (Math.random() - 0.5) * 20;
          brain.targetZ = (Math.random() - 0.5) * 26;
          brain.nextDecisionAt = now + 4000 + Math.random() * 3000;
        }
      }

      if (bot.carrying) {
        brain.state = 'return';
        brain.targetX = ownPlot.depositPad.x;
        brain.targetZ = ownPlot.depositPad.z;
      }

      // Move smoothly toward target
      const dx = brain.targetX - bot.x;
      const dz = brain.targetZ - bot.z;
      const dist = Math.hypot(dx, dz);
      const speed = bot.carrying ? 6.2 : 8.5;

      if (dist > 0.6) {
        const step = Math.min(dist, speed * dt);
        bot.x += (dx / dist) * step;
        bot.z += (dz / dist) * step;
        bot.yaw = Math.atan2(dx, dz);
        bot.isMoving = true;
      } else {
        bot.isMoving = false;
        if (brain.state === 'buy' && brain.targetConveyorId) {
          const idx = this.conveyor.findIndex((c) => c.id === brain.targetConveyorId);
          if (idx !== -1 && bot.coins >= this.conveyor[idx].price) {
            const item = this.conveyor[idx];
            const slot = this.findFreeSlot(bot);
            if (slot !== -1) {
              bot.coins -= item.price;
              this.conveyor.splice(idx, 1);
              bot.memelings.push({
                instanceId: uid('mem'),
                creatureId: item.creatureId,
                mutation: item.mutation,
                level: 1,
                slotIndex: slot,
                locked: false,
                favorite: false,
                acquiredAt: now,
              });
              this.recomputeIncome(bot);
            }
          }
          brain.state = 'roam';
          brain.nextDecisionAt = now + 2000;
        } else if (brain.state === 'raid' && brain.targetBaseIndex !== undefined) {
          const victim = Array.from(this.players.values()).find((p) => p.baseIndex === brain.targetBaseIndex);
          if (victim && victim.baseLockedUntil < now && victim.memelings.length > 1) {
            const targetIdx = victim.memelings.length - 1;
            const stolen = victim.memelings.splice(targetIdx, 1)[0];
            this.recomputeIncome(victim);
            bot.carrying = {
              instanceId: stolen.instanceId,
              creatureId: stolen.creatureId,
              mutation: stolen.mutation,
              level: stolen.level,
              fromBaseIndex: victim.baseIndex,
              fromPlayerId: victim.id,
              fromPlayerName: victim.name,
              stolenAt: now,
            };
            const def = CREATURE_BY_ID[stolen.creatureId];
            this.emitPlayerAlert(victim.id, {
              id: uid('alert'),
              kind: 'theft',
              title: 'RIVAL RAID ALERT!',
              message: `${bot.name} grabbed your ${def?.name ?? 'Memeling'}! Run into them to bonk it back!`,
              accentColor: '#f43f5e',
              timestamp: now,
            });
          }
          brain.state = 'return';
        } else if (brain.state === 'return' && bot.carrying) {
          this.completeHeistDelivery(bot);
          brain.state = 'roam';
          brain.nextDecisionAt = now + 3500;
        }
      }
    }
  }

  public destroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
    this.savePersistence();
  }
}
