import { useCallback, useRef } from 'react';
import { GameHUD } from './components/GameHUD';
import { GameModals } from './components/GameModals';
import { MobileControls } from './components/MobileControls';
import { TitleScreen } from './components/TitleScreen';
import { MemeverseViewport, type MobileInputState } from './game/MemeverseViewport';
import { useGameStore } from './store/gameStore';

export default function App() {
  const screen = useGameStore((s) => s.screen);

  const mobileInputRef = useRef<MobileInputState>({
    moveX: 0,
    moveZ: 0,
    jumpPressed: false,
    sprint: false,
  });

  const onTriggerInteractRef = useRef<(() => void) | null>(null);

  const handleInteract = useCallback(() => {
    onTriggerInteractRef.current?.();
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b1020]">
      {/* Isolated 3D WebGL Viewport — never unmounts on UI state changes */}
      <MemeverseViewport
        mobileInputRef={mobileInputRef}
        onTriggerInteractRef={onTriggerInteractRef}
      />

      {/* Game Shell Overlays */}
      {screen === 'title' ? (
        <TitleScreen />
      ) : (
        <>
          <GameHUD onInteractClick={handleInteract} />
          <MobileControls mobileInputRef={mobileInputRef} onInteract={handleInteract} />
          <GameModals />
        </>
      )}
    </main>
  );
}
