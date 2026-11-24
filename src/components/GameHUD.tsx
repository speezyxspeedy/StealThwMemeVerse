import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Backpack,
  ChevronDown,
  ChevronUp,
  Coins,
  Crown,
  Flame,
  Gem,
  Gift,
  Home,
  Lock,
  MessageSquare,
  Pause,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CREATURE_BY_ID, formatNumber } from '../shared/creatures';
import { selectLocalPlayer, useGameStore } from '../store/gameStore';

interface GameHUDProps {
  onInteractClick: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ onInteractClick }) => {
  const me = useGameStore(selectLocalPlayer);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const activeEvent = useGameStore((s) => s.activeEvent);
  const nextEventAt = useGameStore((s) => s.nextEventAt);
  const serverTimeOffset = useGameStore((s) => s.serverTimeOffset);
  const prompt = useGameStore((s) => s.prompt);
  const alerts = useGameStore((s) => s.alerts);
  const popups = useGameStore((s) => s.popups);
  const activeTrade = useGameStore((s) => s.activeTrade);
  const hudCollapsed = useGameStore((s) => s.hudCollapsed);
  const muted = useGameStore((s) => s.muted);

  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const toggleHudCollapsed = useGameStore((s) => s.toggleHudCollapsed);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const lockBase = useGameStore((s) => s.lockBase);
  const teleportHome = useGameStore((s) => s.teleportHome);
  const dropCarried = useGameStore((s) => s.dropCarried);
  const dismissAlert = useGameStore((s) => s.dismissAlert);

  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [showQuestsStrip, setShowQuestsStrip] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // 1-second timer tick solely for shield/event countdown text (never triggers 3D re-renders)
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  if (!me) return null;

  const serverNow = nowMs + serverTimeOffset;
  const shieldLeftSec = Math.max(0, Math.ceil((me.baseLockedUntil - serverNow) / 1000));
  const shieldCooldownSec = Math.max(0, Math.ceil((me.baseLockCooldownUntil - serverNow) / 1000));
  const cloakLeftSec = Math.max(0, Math.ceil((me.isInvisibleUntil - serverNow) / 1000));
  const eventLeftSec = activeEvent ? Math.max(0, Math.ceil((activeEvent.endsAt - serverNow) / 1000)) : 0;
  const nextEventSec = Math.max(0, Math.ceil((nextEventAt - serverNow) / 1000));
  const maxSlots = Math.min(12, 6 + me.upgrades.baseSlots);
  const claimableQuests = me.quests.filter((q) => !q.claimed && q.progress >= q.target).length;
  const carriedDef = me.carrying ? CREATURE_BY_ID[me.carrying.creatureId] : null;
  const xpPct = Math.min(100, Math.round((me.xp / Math.max(1, me.xpToNext)) * 100));

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-4">
      {/* ================= TOP PERIMETER BAR ================= */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Currencies & Player Level */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 bg-[#0b1020]/90 border border-white/15 rounded-xl px-3.5 py-2 shadow-lg">
          <div className="flex items-center gap-2 pr-3 border-r border-white/10">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="leading-tight">
              <div className="font-mono-num text-sm md:text-base font-bold text-white">
                {formatNumber(me.coins)}
              </div>
              <div className="font-mono-num text-[11px] font-semibold text-emerald-400">
                +{formatNumber(me.incomePerSec)}/s
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pr-3 border-r border-white/10">
            <Gem className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-mono-num text-sm md:text-base font-bold text-white">
              {formatNumber(me.gems)}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white whitespace-nowrap">
                <span>Lv.{me.level}</span>
                <span className="text-slate-400">·</span>
                <span className="text-amber-300">R{me.rebirths} ({me.rebirthMultiplier}x)</span>
              </div>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-sky-400 transition-transform origin-left"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top-Center: World Event Ticker (or Active Heist Warning) */}
        <div className="hidden md:flex flex-col items-center gap-1.5">
          {activeEvent ? (
            <div
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0b1020]/92 border text-xs font-semibold text-white shadow-lg"
              style={{ borderColor: activeEvent.accentHex }}
            >
              <Sparkles className="w-4 h-4 shrink-0" style={{ color: activeEvent.accentHex }} />
              <span>{activeEvent.name}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-200">{activeEvent.incomeMultiplier}x Coins</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono-num text-amber-300">{eventLeftSec}s</span>
            </div>
          ) : (
            <div className="px-3.5 py-1.5 rounded-lg bg-[#0b1020]/75 border border-white/10 text-[11px] font-medium text-slate-300">
              Next World Event in <span className="font-mono-num text-white">{nextEventSec}s</span> · Base Plot #{me.baseIndex + 1} ({me.memelings.length}/{maxSlots})
            </div>
          )}

          {cloakLeftSec > 0 && (
            <div className="px-3 py-1 rounded-lg bg-purple-950/90 border border-purple-400/50 text-xs font-bold text-purple-200">
              Sneak Cloak Active · {cloakLeftSec}s
            </div>
          )}
        </div>

        {/* Top-Right: Compact Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-[#0b1020]/90 border border-white/15 rounded-xl p-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => setShowQuestsStrip((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              showQuestsStrip ? 'bg-white/12 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Quests{claimableQuests > 0 ? ` (${claimableQuests})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setShowLeaderboard((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              showLeaderboard ? 'bg-white/12 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Ranks
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('pause')}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Pause and Controls"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= MIDDLE LAYER: COMPACT CORNER TRACKERS & ALERTS ================= */}
      <div className="relative flex-1 flex items-start justify-between my-2 pointer-events-none">
        {/* Left Compact Quests & Daily Strip (only when not collapsed & toggled on) */}
        <div className="flex flex-col gap-2 max-w-[235px]">
          {!hudCollapsed && showQuestsStrip && (
            <div className="pointer-events-auto hidden lg:flex flex-col gap-2 bg-[#0b1020]/88 border border-white/12 rounded-xl p-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  Missions
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModal('quests')}
                  className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Open All
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {me.quests
                  .filter((q) => !q.claimed)
                  .slice(0, 3)
                  .map((q) => {
                    const done = q.progress >= q.target;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setActiveModal('quests')}
                        className="text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-100">
                          <span className="truncate">{q.title}</span>
                          <span className={`font-mono-num shrink-0 ${done ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {done ? 'Claim!' : `${formatNumber(q.progress)}/${formatNumber(q.target)}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Incoming Trade Banner */}
          {activeTrade && (
            <button
              type="button"
              onClick={() => setActiveModal('trade')}
              className="pointer-events-auto text-left px-3.5 py-2.5 rounded-xl bg-emerald-950/92 border border-emerald-400/60 text-xs font-semibold text-emerald-100 shadow-lg cursor-pointer"
            >
              Active Trade with {activeTrade.fromPlayerId === me.id ? activeTrade.toPlayerName : activeTrade.fromPlayerName} · Click to open
            </button>
          )}
        </div>

        {/* Center Alerts & Carried Stolen Memeling Banner */}
        <div className="flex flex-col items-center gap-2 max-w-md mx-auto">
          {me.carrying && (
            <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-xl bg-rose-950/95 border border-rose-400/70 shadow-xl">
              <Flame className="w-5 h-5 text-amber-300 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-extrabold text-amber-300 tracking-wide">
                  CARRYING STOLEN {carriedDef?.name.toUpperCase() ?? 'MEMELING'}!
                </div>
                <div className="text-[11px] text-rose-100">
                  Run back to Plot #{me.baseIndex + 1} Deposit Pad to keep it!
                </div>
              </div>
              <button
                type="button"
                onClick={dropCarried}
                className="px-2.5 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-[11px] font-bold text-white cursor-pointer shrink-0"
              >
                Drop
              </button>
            </div>
          )}

          {alerts.map((al) => (
            <div
              key={al.id}
              onClick={() => dismissAlert(al.id)}
              className="pointer-events-auto cursor-pointer px-4 py-2 rounded-xl bg-[#0b1020]/94 border shadow-lg text-center max-w-sm"
              style={{ borderColor: al.accentColor }}
            >
              <div className="text-xs font-extrabold tracking-wide" style={{ color: al.accentColor }}>
                {al.title}
              </div>
              <div className="text-xs text-slate-200 mt-0.5">{al.message}</div>
            </div>
          ))}
        </div>

        {/* Right Compact Leaderboard */}
        {!hudCollapsed && showLeaderboard && (
          <div className="pointer-events-auto hidden lg:flex flex-col gap-1.5 w-[228px] bg-[#0b1020]/88 border border-white/12 rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200 pb-1 border-b border-white/10">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Top Tycoons
              </span>
              <span className="font-mono-num text-[11px] text-slate-400">{leaderboard.length} Live</span>
            </div>
            <div className="flex flex-col gap-1">
              {leaderboard.slice(0, 6).map((entry, idx) => {
                const isMe = entry.playerId === me.id;
                return (
                  <div
                    key={entry.playerId}
                    className={`flex items-center justify-between gap-2 text-xs px-2 py-1 rounded-md ${
                      isMe ? 'bg-sky-500/20 text-white font-bold' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono-num text-[11px] text-slate-400 w-3.5">{idx + 1}</span>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: entry.avatarColor }}
                      />
                      <span className="truncate">{entry.name}</span>
                    </div>
                    <span className="font-mono-num text-[11px] text-amber-300 shrink-0">
                      {formatNumber(entry.incomePerSec)}/s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================= FLOATING FEEDBACK POPUPS ================= */}
      {popups.map((p) => (
        <div
          key={p.id}
          className="fixed z-30 pointer-events-none font-display font-extrabold text-base md:text-lg drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)] animate-float-up"
          style={{ left: `${p.xPercent}%`, top: `${p.yPercent}%`, color: p.color }}
        >
          {p.text}
        </div>
      ))}

      {/* ================= BOTTOM CONTEXT PROMPT + UNIFIED ACTION DOCK ================= */}
      <div className="flex flex-col items-center gap-2.5">
        {/* Contextual Interact Prompt */}
        {prompt && (
          <button
            type="button"
            onClick={onInteractClick}
            className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0b1020]/94 border shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer"
            style={{ borderColor: prompt.accentColor }}
          >
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center font-mono-num text-xs font-extrabold text-slate-950 shrink-0"
              style={{ backgroundColor: prompt.accentColor }}
            >
              {prompt.keyLabel}
            </span>
            <div className="text-left leading-tight">
              <div className="text-sm font-bold text-white">{prompt.actionLabel}</div>
              {prompt.subtitle && <div className="text-[11px] text-slate-300">{prompt.subtitle}</div>}
            </div>
          </button>
        )}

        {/* Collapsible Zen Toggle */}
        <button
          type="button"
          onClick={toggleHudCollapsed}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-[#0b1020]/88 border border-b-0 border-white/12 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Toggle HUD (H)"
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {/* Unified Bottom Dock */}
        {!hudCollapsed && (
          <div className="pointer-events-auto flex items-center gap-1.5 md:gap-2 px-2.5 py-2 rounded-2xl bg-[#0b1020]/92 border border-white/15 shadow-2xl max-w-[96vw] overflow-x-auto">
            <DockButton
              icon={<Backpack className="w-4 h-4 text-sky-400" />}
              label={`Base (${me.memelings.length}/${maxSlots})`}
              onClick={() => setActiveModal('inventory')}
            />
            <DockButton
              icon={<ShoppingBag className="w-4 h-4 text-emerald-400" />}
              label="Shop"
              onClick={() => setActiveModal('shop')}
            />
            <DockButton
              icon={<Sparkles className="w-4 h-4 text-purple-400" />}
              label="Lucky"
              onClick={() => setActiveModal('lucky')}
            />
            <DockButton
              icon={<RotateCcw className="w-4 h-4 text-amber-400" />}
              label="Rebirth"
              onClick={() => setActiveModal('rebirth')}
            />
            <DockButton
              icon={<Gift className="w-4 h-4 text-rose-400" />}
              label={claimableQuests > 0 ? `Quests (${claimableQuests})` : 'Quests'}
              onClick={() => setActiveModal('quests')}
            />
            <DockButton
              icon={<MessageSquare className="w-4 h-4 text-cyan-400" />}
              label="Trade & Chat"
              onClick={() => setActiveModal('trade')}
            />

            <div className="w-px h-7 bg-white/12 mx-0.5 shrink-0" />

            {/* Base Lock Shield Action */}
            <button
              type="button"
              onClick={lockBase}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                shieldLeftSec > 0
                  ? 'bg-sky-500/25 border border-sky-400/60 text-sky-200'
                  : shieldCooldownSec > 0
                    ? 'bg-slate-800/90 text-slate-400 border border-white/10'
                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
              }`}
              title="Activate Base Laser Shield (L)"
            >
              {shieldLeftSec > 0 ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-mono-num">Shield {shieldLeftSec}s</span>
                </>
              ) : shieldCooldownSec > 0 ? (
                <>
                  <Unlock className="w-4 h-4" />
                  <span className="font-mono-num">Ready {shieldCooldownSec}s</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Lock Base [L]</span>
                </>
              )}
            </button>

            <DockButton
              icon={<Home className="w-4 h-4 text-amber-300" />}
              label="Home [B]"
              onClick={teleportHome}
            />
          </div>
        )}
      </div>
    </div>
  );
};

interface DockButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

const DockButton: React.FC<DockButtonProps> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 text-xs font-semibold text-slate-100 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Suppress unused icon warning if needed
export const _unusedIcons = [Crown, ArrowDown, ArrowUp];
