// 100% procedural Web Audio API sound effects engine — zero external assets

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private volume = 0.42;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainScale = 0.25,
    delay = 0,
    endFreq?: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    const peak = Math.max(0.001, this.volume * gainScale);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playJump(): void {
    this.playTone(230, 0.14, 'triangle', 0.22, 0, 480);
  }

  public playCoin(): void {
    this.playTone(987.77, 0.08, 'sine', 0.16, 0);
    this.playTone(1318.51, 0.14, 'sine', 0.18, 0.06);
  }

  public playPurchase(rarityOrder = 1): void {
    const base = 392 + rarityOrder * 45;
    this.playTone(base, 0.12, 'triangle', 0.25, 0);
    this.playTone(base * 1.25, 0.14, 'triangle', 0.25, 0.07);
    this.playTone(base * 1.5, 0.24, 'sine', 0.28, 0.14);
    if (rarityOrder >= 5) {
      this.playTone(base * 2, 0.36, 'sine', 0.26, 0.22);
    }
  }

  public playStealAlarm(): void {
    this.playTone(620, 0.15, 'sawtooth', 0.2, 0, 460);
    this.playTone(620, 0.15, 'sawtooth', 0.2, 0.18, 460);
    this.playTone(740, 0.22, 'sawtooth', 0.22, 0.36, 520);
  }

  public playHeistComplete(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.playTone(n, 0.22, 'triangle', 0.26, i * 0.075);
    });
  }

  public playBaseLock(): void {
    this.playTone(180, 0.28, 'sawtooth', 0.18, 0, 520);
    this.playTone(540, 0.22, 'sine', 0.22, 0.14, 720);
  }

  public playRareSpawn(): void {
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((n, i) => {
      this.playTone(n, 0.34, 'sine', 0.2, i * 0.08);
    });
  }

  public playRebirth(): void {
    this.playTone(130.81, 0.65, 'sawtooth', 0.22, 0, 523.25);
    [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].forEach((n, i) => {
      this.playTone(n, 0.45, 'triangle', 0.22, 0.12 + i * 0.07);
    });
  }

  public playLuckyCrack(): void {
    [320, 410, 510, 620, 880].forEach((n, i) => {
      this.playTone(n, 0.11, 'square', 0.12, i * 0.06);
    });
    this.playTone(1046.5, 0.35, 'triangle', 0.28, 0.34);
  }

  public playError(): void {
    this.playTone(210, 0.12, 'sawtooth', 0.16, 0, 150);
  }

  public playClick(): void {
    this.playTone(660, 0.05, 'sine', 0.12, 0, 740);
  }
}

export const soundEngine = new SoundEngine();
