import React, { useRef, useState } from 'react';
import { ArrowUp, Hand, Lock } from 'lucide-react';
import type { MobileInputState } from '../game/MemeverseViewport';
import { useGameStore } from '../store/gameStore';

interface MobileControlsProps {
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  onInteract: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ mobileInputRef, onInteract }) => {
  const lockBase = useGameStore((s) => s.lockBase);
  const activeModal = useGameStore((s) => s.activeModal);
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  if (activeModal !== 'none') return null;

  const updateStick = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxR);
    const ang = Math.atan2(dy, dx);
    const kx = Math.cos(ang) * clamped;
    const ky = Math.sin(ang) * clamped;
    setKnob({ x: kx, y: ky });
    mobileInputRef.current.moveX = kx / maxR;
    mobileInputRef.current.moveZ = ky / maxR;
    mobileInputRef.current.sprint = dist > maxR * 0.85;
  };

  const resetStick = () => {
    touchIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    mobileInputRef.current.moveX = 0;
    mobileInputRef.current.moveZ = 0;
    mobileInputRef.current.sprint = false;
  };

  return (
    <div className="fixed inset-x-0 bottom-20 z-20 flex md:hidden items-end justify-between px-4 pointer-events-none">
      {/* Virtual Thumbstick */}
      <div
        ref={padRef}
        onPointerDown={(e) => {
          touchIdRef.current = e.pointerId;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (touchIdRef.current === e.pointerId) updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={resetStick}
        onPointerCancel={resetStick}
        className="pointer-events-auto relative w-28 h-28 rounded-full bg-[#0b1020]/75 border-2 border-white/20 flex items-center justify-center touch-none"
        aria-label="Movement Joystick"
      >
        <div
          className="w-12 h-12 rounded-full bg-amber-400/90 border-2 border-white shadow-lg"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      {/* Right Action Cluster */}
      <div className="pointer-events-auto flex items-center gap-2.5">
        <button
          type="button"
          onPointerDown={() => lockBase()}
          className="w-12 h-12 rounded-full bg-sky-500/90 border-2 border-white/30 text-slate-950 flex items-center justify-center active:scale-95"
          aria-label="Lock Base"
        >
          <Lock className="w-5 h-5" />
        </button>
        <button
          type="button"
          onPointerDown={() => onInteract()}
          className="w-14 h-14 rounded-full bg-amber-400/95 border-2 border-white/40 text-slate-950 flex items-center justify-center active:scale-95"
          aria-label="Interact"
        >
          <Hand className="w-6 h-6" />
        </button>
        <button
          type="button"
          onPointerDown={() => {
            mobileInputRef.current.jumpPressed = true;
          }}
          className="w-14 h-14 rounded-full bg-emerald-400/95 border-2 border-white/40 text-slate-950 flex items-center justify-center active:scale-95"
          aria-label="Jump"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
