import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

const AVATAR_SWATCHES = [
  { color: '#38bdf8', label: 'Sky' },
  { color: '#f43f5e', label: 'Crimson' },
  { color: '#22c55e', label: 'Emerald' },
  { color: '#f59e0b', label: 'Gold' },
  { color: '#a855f7', label: 'Cosmic' },
  { color: '#ec4899', label: 'Prism' },
];

export const TitleScreen: React.FC = () => {
  const playerName = useGameStore((s) => s.playerName);
  const avatarColor = useGameStore((s) => s.avatarColor);
  const joining = useGameStore((s) => s.joining);
  const connected = useGameStore((s) => s.connected);
  const playersCount = useGameStore((s) => s.players.length);
  const muted = useGameStore((s) => s.muted);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const setAvatarColor = useGameStore((s) => s.setAvatarColor);
  const connectAndJoin = useGameStore((s) => s.connectAndJoin);
  const toggleMute = useGameStore((s) => s.toggleMute);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joining) connectAndJoin();
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between p-6 md:p-10 pointer-events-none">
      {/* Top minimal utility corner */}
      <div className="flex items-center justify-between">
        <div className="pointer-events-auto text-xs font-medium tracking-wide text-slate-200 bg-[#0b1020]/85 border border-white/15 px-3.5 py-2 rounded-lg">
          {connected ? `${playersCount} Tycoons in Plaza` : 'Connecting to Plaza...'}
        </div>
        <button
          type="button"
          onClick={toggleMute}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-100 bg-[#0b1020]/85 hover:bg-[#141d38] border border-white/15 rounded-lg transition-colors cursor-pointer"
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        >
          {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
          <span>{muted ? 'Muted' : 'Audio On'}</span>
        </button>
      </div>

      {/* Center-bottom anchored bespoke title lockup & compact entry card so 40%+ upper live 3D world breathes */}
      <div className="flex flex-col items-center gap-6 my-auto">
        <div className="flex flex-col items-center text-center select-none">
          <svg
            viewBox="0 0 760 176"
            className="w-[min(92vw,680px)] h-auto drop-shadow-[0_12px_28px_rgba(7,12,28,0.85)]"
            role="img"
            aria-label="Steal the Memeverse"
          >
            <defs>
              <linearGradient id="mvGold" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="52%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
              <linearGradient id="mvSky" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>

            {/* Decorative emblem crown & lightning accent */}
            <polygon
              points="344,24 358,6 380,20 402,6 416,24 408,34 352,34"
              fill="url(#mvGold)"
              stroke="#0b1020"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* Top word: STEAL THE */}
            <text
              x="380"
              y="76"
              textAnchor="middle"
              fontFamily="Bricolage Grotesque, system-ui, sans-serif"
              fontWeight="800"
              fontSize="44"
              letterSpacing="6"
              fill="#f8fafc"
              stroke="#0b1020"
              strokeWidth="9"
              paintOrder="stroke"
            >
              STEAL THE
            </text>

            {/* Primary title: MEMEVERSE */}
            <text
              x="380"
              y="150"
              textAnchor="middle"
              fontFamily="Bricolage Grotesque, system-ui, sans-serif"
              fontWeight="800"
              fontSize="84"
              letterSpacing="2"
              fill="url(#mvGold)"
              stroke="#0b1020"
              strokeWidth="13"
              paintOrder="stroke"
            >
              MEMEVERSE
            </text>

            {/* Crisp accent bar */}
            <rect x="210" y="164" width="340" height="6" rx="3" fill="url(#mvSky)" />
          </svg>

          <p className="mt-2 text-sm md:text-base font-medium text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] max-w-xl text-balance">
            Collect 36 bizarre Memelings off the live conveyor, shield your vault, and heist your rivals in 3D multiplayer.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto w-full max-w-md bg-[#0b1020]/92 border border-white/15 rounded-2xl p-5 shadow-2xl flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mv-username" className="text-xs font-semibold text-slate-300">
              Tycoon Name
            </label>
            <input
              id="mv-username"
              type="text"
              maxLength={18}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter username"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#141c33] border border-white/15 text-sm font-semibold text-white placeholder-slate-400 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-300">Avatar Suit</span>
            <div className="flex items-center gap-2">
              {AVATAR_SWATCHES.map((swatch) => {
                const active = avatarColor === swatch.color;
                return (
                  <button
                    key={swatch.color}
                    type="button"
                    onClick={() => setAvatarColor(swatch.color)}
                    title={swatch.label}
                    aria-label={`Select ${swatch.label} suit`}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                      active ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: swatch.color }}
                  />
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={joining}
            className="w-full py-3.5 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-display font-extrabold text-base tracking-wide transition-all cursor-pointer disabled:opacity-60"
          >
            {joining ? 'Entering Memeverse...' : 'Play Now'}
          </button>
        </form>
      </div>

      {/* Single flat control hint line */}
      <div className="text-center">
        <p className="inline-block text-xs font-medium text-slate-200 bg-[#0b1020]/85 border border-white/10 px-4 py-2 rounded-lg">
          WASD Move · Mouse Drag Camera · Space Jump · Shift Sprint · E Interact · L Lock Base · B Home
        </p>
      </div>
    </div>
  );
};
