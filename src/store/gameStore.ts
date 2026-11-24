import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { soundEngine } from '../game/soundEngine';
import { CREATURE_BY_ID, RARITY_META } from '../shared/creatures';
import type {
  ActiveWorldEvent,
  ChatMessage,
  ConveyorItem,
  LeaderboardEntry,
  LuckyBlockResult,
  PlayerState,
  PlayerUpgrades,
  TradeOffer,
  WorldAlert,
  WorldSnapshot,
} from '../shared/types';

export type ScreenMode = 'title' | 'playing';
export type ModalTab =
  | 'none'
  | 'inventory'
  | 'shop'
  | 'rebirth'
  | 'lucky'
  | 'trade'
  | 'quests'
  | 'pause';

export interface InteractionPrompt {
  id: string;
  keyLabel: string;
  actionLabel: string;
  subtitle?: string;
  accentColor: string;
  kind: 'buy' | 'steal' | 'lock' | 'shop' | 'rebirth' | 'lucky' | 'chest' | 'trade';
  payload?: Record<string, string>;
}

export interface FloatingPopup {
  id: string;
  text: string;
  color: string;
  xPercent: number;
  yPercent: number;
}

interface GameStoreState {
  screen: ScreenMode;
  connected: boolean;
  joining: boolean;
  playerId: string | null;
  playerName: string;
  avatarColor: string;

  // Authoritative world state synced from Socket.IO
  serverTimeOffset: number;
  players: PlayerState[];
  conveyor: ConveyorItem[];
  activeEvent: ActiveWorldEvent | null;
  nextEventAt: number;
  leaderboard: LeaderboardEntry[];
  chat: ChatMessage[];
  activeTrade: TradeOffer | null;

  // UI state
  activeModal: ModalTab;
  hudCollapsed: boolean;
  muted: boolean;
  prompt: InteractionPrompt | null;
  alerts: WorldAlert[];
  popups: FloatingPopup[];
  lastLuckyResult: LuckyBlockResult | null;
  cameraShakeRequest: number;
  teleportRequest: { x: number; z: number; seq: number } | null;

  // Actions
  setPlayerName: (name: string) => void;
  setAvatarColor: (color: string) => void;
  setActiveModal: (modal: ModalTab) => void;
  toggleHudCollapsed: () => void;
  toggleMute: () => void;
  setPrompt: (prompt: InteractionPrompt | null) => void;
  pushPopup: (text: string, color?: string, xPercent?: number, yPercent?: number) => void;
  dismissAlert: (id: string) => void;
  clearLuckyResult: () => void;
  triggerScreenShake: (strength?: number) => void;

  // Networking
  connectAndJoin: () => Promise<void>;
  sendMove: (x: number, y: number, z: number, yaw: number, isMoving: boolean, isSprinting: boolean) => void;
  buyConveyorItem: (itemId: string) => void;
  stealMemeling: (targetPlayerId: string, instanceId: string) => void;
  dropCarried: () => void;
  lockBase: () => void;
  teleportHome: () => void;
  sellMemeling: (instanceId: string) => void;
  toggleMemelingLock: (instanceId: string) => void;
  toggleMemelingFavorite: (instanceId: string) => void;
  fuseMemeling: (instanceId: string) => void;
  buyUpgrade: (key: keyof PlayerUpgrades) => void;
  buyOrEquipCosmetic: (cosmeticId: string) => void;
  activateSneakCloak: () => void;
  performRebirth: () => void;
  openLuckyBlock: (tier: 'basic' | 'epic' | 'celestial') => void;
  claimQuest: (questId: string) => void;
  claimDaily: () => void;
  claimSkyChest: () => void;
  requestTrade: (targetPlayerId: string) => void;
  acceptTrade: (tradeId: string) => void;
  toggleTradeItem: (tradeId: string, instanceId: string) => void;
  toggleTradeReady: (tradeId: string) => void;
  cancelTrade: (tradeId: string) => void;
  sendChat: (text: string) => void;
}

let socket: Socket | null = null;
let lastMoveSentAt = 0;

function getOrCreateToken(): string {
  try {
    const existing = localStorage.getItem('memeverse_token');
    if (existing) return existing;
    const next = `mv-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem('memeverse_token', next);
    return next;
  } catch {
    return `mv-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getSavedName(): string {
  try {
    return localStorage.getItem('memeverse_name') || `Raider${Math.floor(100 + Math.random() * 899)}`;
  } catch {
    return 'MemeRaider';
  }
}

export const useGameStore = create<GameStoreState>((set, get) => {
  const pushLocalAlert = (
    kind: WorldAlert['kind'],
    title: string,
    message: string,
    accentColor: string,
  ) => {
    const id = `al-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      alerts: [{ id, kind, title, message, accentColor, timestamp: Date.now() }, ...s.alerts].slice(0, 4),
    }));
    window.setTimeout(() => {
      set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
    }, 5200);
  };

  const ensureSocket = (): Socket => {
    if (socket) return socket;
    socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 800,
    });

    socket.on('connect', () => {
      set({ connected: true });
      // Auto-rejoin if user was already playing
      if (get().screen === 'playing') {
        const { playerName, avatarColor } = get();
        socket?.emit(
          'player:join',
          { name: playerName, token: getOrCreateToken(), avatarColor },
          (res: { ok: boolean; playerId?: string; snapshot?: WorldSnapshot }) => {
            if (res?.ok && res.snapshot) {
              set({
                playerId: res.playerId ?? null,
                serverTimeOffset: res.snapshot.serverTime - Date.now(),
                players: res.snapshot.players,
                conveyor: res.snapshot.conveyor,
                activeEvent: res.snapshot.activeEvent,
                nextEventAt: res.snapshot.nextEventAt,
                leaderboard: res.snapshot.leaderboard,
                chat: res.snapshot.chat,
                activeTrade: res.snapshot.activeTrade,
              });
            }
          },
        );
      }
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    socket.on('world:state', (snap: WorldSnapshot) => {
      set({
        serverTimeOffset: snap.serverTime - Date.now(),
        players: snap.players,
        conveyor: snap.conveyor,
        activeEvent: snap.activeEvent,
        nextEventAt: snap.nextEventAt,
        leaderboard: snap.leaderboard,
        activeTrade: snap.activeTrade,
      });
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      set((s) => {
        if (s.chat.some((c) => c.id === msg.id)) return s;
        return { chat: [...s.chat.slice(-39), msg] };
      });
    });

    socket.on('world:alert', (alert: WorldAlert) => {
      set((s) => ({
        alerts: [alert, ...s.alerts].slice(0, 4),
      }));
      if (alert.kind === 'theft') {
        soundEngine.playStealAlarm();
        get().triggerScreenShake(0.75);
      } else if (alert.kind === 'rare_spawn') {
        soundEngine.playRareSpawn();
      } else if (alert.kind === 'heist_success') {
        soundEngine.playHeistComplete();
        get().triggerScreenShake(0.5);
      } else if (alert.kind === 'rebirth') {
        soundEngine.playRebirth();
        get().triggerScreenShake(0.9);
      } else if (alert.kind === 'event') {
        soundEngine.playRareSpawn();
      }
      window.setTimeout(() => {
        set((s) => ({ alerts: s.alerts.filter((a) => a.id !== alert.id) }));
      }, 5600);
    });

    return socket;
  };

  // Start passive socket connection immediately so title screen renders the live world!
  if (typeof window !== 'undefined') {
    ensureSocket();
  }

  return {
    screen: 'title',
    connected: false,
    joining: false,
    playerId: null,
    playerName: getSavedName(),
    avatarColor: '#38bdf8',

    serverTimeOffset: 0,
    players: [],
    conveyor: [],
    activeEvent: null,
    nextEventAt: Date.now() + 45_000,
    leaderboard: [],
    chat: [],
    activeTrade: null,

    activeModal: 'none',
    hudCollapsed: false,
    muted: false,
    prompt: null,
    alerts: [],
    popups: [],
    lastLuckyResult: null,
    cameraShakeRequest: 0,
    teleportRequest: null,

    setPlayerName: (name) => {
      set({ playerName: name });
      try {
        localStorage.setItem('memeverse_name', name);
      } catch {
        // ignore storage restrictions
      }
    },

    setAvatarColor: (avatarColor) => set({ avatarColor }),

    setActiveModal: (activeModal) => {
      soundEngine.playClick();
      set({ activeModal });
    },

    toggleHudCollapsed: () => set((s) => ({ hudCollapsed: !s.hudCollapsed })),

    toggleMute: () => {
      const next = !get().muted;
      soundEngine.setMuted(next);
      set({ muted: next });
    },

    setPrompt: (prompt) => {
      const current = get().prompt;
      if (
        current?.id === prompt?.id &&
        current?.actionLabel === prompt?.actionLabel &&
        current?.subtitle === prompt?.subtitle
      ) {
        return;
      }
      set({ prompt });
    },

    pushPopup: (text, color = '#fbbf24', xPercent = 50, yPercent = 45) => {
      const id = `pop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      set((s) => ({
        popups: [...s.popups.slice(-8), { id, text, color, xPercent, yPercent }],
      }));
      window.setTimeout(() => {
        set((s) => ({ popups: s.popups.filter((p) => p.id !== id) }));
      }, 1300);
    },

    dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
    clearLuckyResult: () => set({ lastLuckyResult: null }),
    triggerScreenShake: (strength = 0.5) =>
      set({ cameraShakeRequest: Date.now() + Math.min(1, strength) * 0.001 }),

    connectAndJoin: async () => {
      const sock = ensureSocket();
      set({ joining: true });
      const { playerName, avatarColor } = get();
      const token = getOrCreateToken();

      await new Promise<void>((resolve) => {
        const doJoin = () => {
          sock.emit(
            'player:join',
            { name: playerName.trim() || 'MemeRaider', token, avatarColor },
            (res: { ok: boolean; playerId?: string; snapshot?: WorldSnapshot; error?: string }) => {
              if (res?.ok && res.snapshot) {
                const me = res.snapshot.players.find((p) => p.id === res.playerId);
                set({
                  joining: false,
                  screen: 'playing',
                  playerId: res.playerId ?? null,
                  serverTimeOffset: res.snapshot.serverTime - Date.now(),
                  players: res.snapshot.players,
                  conveyor: res.snapshot.conveyor,
                  activeEvent: res.snapshot.activeEvent,
                  nextEventAt: res.snapshot.nextEventAt,
                  leaderboard: res.snapshot.leaderboard,
                  chat: res.snapshot.chat,
                  activeTrade: res.snapshot.activeTrade,
                  teleportRequest: me ? { x: me.x, z: me.z, seq: Date.now() } : null,
                });
                soundEngine.playHeistComplete();
              } else {
                set({ joining: false });
                pushLocalAlert('error', 'Join Failed', res?.error ?? 'Could not connect to server.', '#f43f5e');
              }
              resolve();
            },
          );
        };

        if (sock.connected) doJoin();
        else sock.once('connect', doJoin);
      });
    },

    sendMove: (x, y, z, yaw, isMoving, isSprinting) => {
      const now = performance.now();
      if (now - lastMoveSentAt < 50) return; // 20Hz client movement packets
      lastMoveSentAt = now;
      if (socket?.connected && get().screen === 'playing') {
        socket.emit('player:move', { x, y, z, yaw, isMoving, isSprinting });
      }
    },

    buyConveyorItem: (itemId) => {
      socket?.emit('conveyor:buy', { itemId }, (res: { ok: boolean; creatureId?: string; error?: string }) => {
        if (res?.ok && res.creatureId) {
          const def = CREATURE_BY_ID[res.creatureId];
          const order = def ? RARITY_META[def.rarity].order : 1;
          soundEngine.playPurchase(order);
          get().pushPopup(`+${def?.name ?? 'Memeling'}!`, def ? RARITY_META[def.rarity].color : '#4ade80', 50, 42);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Purchase Blocked', res.error, '#f43f5e');
        }
      });
    },

    stealMemeling: (targetPlayerId, instanceId) => {
      socket?.emit('base:steal', { targetPlayerId, instanceId }, (res: { ok: boolean; error?: string }) => {
        if (res?.ok) {
          soundEngine.playStealAlarm();
          get().triggerScreenShake(0.65);
          get().pushPopup('SNATCHED! RUN HOME!', '#fbbf24', 50, 38);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Cannot Steal', res.error, '#f43f5e');
        }
      });
    },

    dropCarried: () => {
      socket?.emit('base:drop', () => {
        soundEngine.playClick();
      });
    },

    lockBase: () => {
      socket?.emit('base:lock', (res: { ok: boolean; durationSec?: number; error?: string }) => {
        if (res?.ok) {
          soundEngine.playBaseLock();
          get().pushPopup(`SHIELD LOCKED (${res.durationSec}s)`, '#38bdf8', 50, 42);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Shield Unavailable', res.error, '#f59e0b');
        }
      });
    },

    teleportHome: () => {
      socket?.emit('player:teleportHome', (res: { ok: boolean; x?: number; z?: number; error?: string }) => {
        if (res?.ok && typeof res.x === 'number' && typeof res.z === 'number') {
          soundEngine.playBaseLock();
          set({ teleportRequest: { x: res.x, z: res.z, seq: Date.now() } });
          get().pushPopup('Returned to Base', '#38bdf8', 50, 45);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Teleport Blocked', res.error, '#f43f5e');
        }
      });
    },

    sellMemeling: (instanceId) => {
      socket?.emit('memeling:sell', { instanceId }, (res: { ok: boolean; earned?: number; error?: string }) => {
        if (res?.ok) {
          soundEngine.playCoin();
          get().pushPopup(`+${(res.earned ?? 0).toLocaleString()} Coins`, '#fbbf24', 52, 46);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Sell Failed', res.error, '#f43f5e');
        }
      });
    },

    toggleMemelingLock: (instanceId) => {
      socket?.emit('memeling:toggleLock', { instanceId }, () => soundEngine.playClick());
    },

    toggleMemelingFavorite: (instanceId) => {
      socket?.emit('memeling:toggleFavorite', { instanceId }, () => soundEngine.playClick());
    },

    fuseMemeling: (instanceId) => {
      socket?.emit('memeling:fuse', { instanceId }, (res: { ok: boolean; newLevel?: number; error?: string }) => {
        if (res?.ok) {
          soundEngine.playPurchase(5);
          get().pushPopup(`FUSED TO LV.${res.newLevel}!`, '#c084fc', 50, 42);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Fusion Failed', res.error, '#f43f5e');
        }
      });
    },

    buyUpgrade: (key) => {
      socket?.emit('shop:upgrade', { key }, (res: { ok: boolean; error?: string }) => {
        if (res?.ok) {
          soundEngine.playPurchase(3);
          get().pushPopup('UPGRADE PURCHASED!', '#4ade80', 50, 42);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Upgrade Failed', res.error, '#f43f5e');
        }
      });
    },

    buyOrEquipCosmetic: (cosmeticId) => {
      socket?.emit('shop:cosmetic', { cosmeticId }, (res: { ok: boolean; error?: string }) => {
        if (res?.ok) {
          soundEngine.playPurchase(4);
          get().pushPopup('Cosmetic Equipped!', '#38bdf8', 50, 44);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Cosmetic Locked', res.error, '#f43f5e');
        }
      });
    },

    activateSneakCloak: () => {
      socket?.emit('shop:cloak', (res: { ok: boolean; error?: string }) => {
        if (res?.ok) {
          soundEngine.playBaseLock();
          get().pushPopup('SNEAK CLOAK ACTIVE (14s)!', '#a855f7', 50, 40);
          set({ activeModal: 'none' });
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Sneak Cloak', res.error, '#f43f5e');
        }
      });
    },

    performRebirth: () => {
      socket?.emit('player:rebirth', (res: { ok: boolean; error?: string }) => {
        if (res?.ok) {
          soundEngine.playRebirth();
          get().triggerScreenShake(0.95);
          get().pushPopup('REBIRTH COMPLETE!', '#fde047', 50, 38);
          set({ activeModal: 'none' });
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Rebirth Locked', res.error, '#f43f5e');
        }
      });
    },

    openLuckyBlock: (tier) => {
      socket?.emit('lucky:open', { tier }, (res: { ok: boolean; result?: LuckyBlockResult; error?: string }) => {
        if (res?.ok && res.result) {
          soundEngine.playLuckyCrack();
          set({ lastLuckyResult: res.result });
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Lucky Block', res.error, '#f43f5e');
        }
      });
    },

    claimQuest: (questId) => {
      socket?.emit('quest:claim', { questId }, (res: { ok: boolean; error?: string }) => {
        if (res?.ok) {
          soundEngine.playHeistComplete();
          get().pushPopup('QUEST REWARD CLAIMED!', '#4ade80', 50, 42);
        } else if (res?.error) {
          soundEngine.playError();
        }
      });
    },

    claimDaily: () => {
      socket?.emit('daily:claim', (res: { ok: boolean; coins?: number; gems?: number; error?: string }) => {
        if (res?.ok) {
          soundEngine.playHeistComplete();
          get().pushPopup(`+${res.coins?.toLocaleString()} Coins · +${res.gems} Gems`, '#fbbf24', 50, 40);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('info', 'Daily Reward', res.error, '#38bdf8');
        }
      });
    },

    claimSkyChest: () => {
      socket?.emit('chest:claim', (res: { ok: boolean; coins?: number; gems?: number; error?: string }) => {
        if (res?.ok) {
          soundEngine.playHeistComplete();
          get().triggerScreenShake(0.5);
          get().pushPopup(`SKY TREASURE! +${res.coins?.toLocaleString()} Coins +${res.gems} Gems`, '#fde047', 50, 38);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('info', 'Sky Treasure', res.error, '#f59e0b');
        }
      });
    },

    requestTrade: (targetPlayerId) => {
      socket?.emit('trade:request', { targetPlayerId }, (res: { ok: boolean; error?: string }) => {
        if (res?.ok) {
          soundEngine.playClick();
          pushLocalAlert('info', 'Trade Sent', 'Waiting for player to accept.', '#38bdf8');
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Trade', res.error, '#f43f5e');
        }
      });
    },

    acceptTrade: (tradeId) => {
      socket?.emit('trade:accept', { tradeId }, () => soundEngine.playClick());
    },

    toggleTradeItem: (tradeId, instanceId) => {
      socket?.emit('trade:toggleItem', { tradeId, instanceId }, () => soundEngine.playClick());
    },

    toggleTradeReady: (tradeId) => {
      socket?.emit('trade:ready', { tradeId }, (res: { ok: boolean; completed?: boolean; error?: string }) => {
        if (res?.completed) {
          soundEngine.playHeistComplete();
          get().pushPopup('TRADE COMPLETED!', '#4ade80', 50, 42);
        } else if (res?.error) {
          soundEngine.playError();
          pushLocalAlert('error', 'Trade', res.error, '#f43f5e');
        }
      });
    },

    cancelTrade: (tradeId) => {
      socket?.emit('trade:cancel', { tradeId }, () => soundEngine.playClick());
    },

    sendChat: (text) => {
      socket?.emit('chat:send', { text }, () => {});
    },
  };
});

export function selectLocalPlayer(state: GameStoreState): PlayerState | undefined {
  if (!state.playerId) return undefined;
  return state.players.find((p) => p.id === state.playerId);
}
