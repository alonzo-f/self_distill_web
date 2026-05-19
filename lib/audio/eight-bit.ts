// v4 8-bit tomb-animation audio.
// Reference: docs/v4-migration-plan.md Phase 7; project_v4 III. 阶段 6.5c
//
// Uses the native Web Audio API (no Tone.js dependency) to play:
//   - 300ms C4 → G3 blip (square wave, fast attack/decay)
//   - 1000ms A1 drone (triangle wave, slow attack, sustained release)
// Both layered so the "moment of archival" has both a UI sting and a
// low-frequency tug.

let cachedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!cachedCtx) {
    // Older Safari prefixes
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    cachedCtx = new Ctor();
  }
  return cachedCtx;
}

/** Resume the audio context. Must be called after a user gesture on iOS / autoplay-restricted browsers. */
export async function unlockAudio(): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* no-op */
    }
  }
}

/** Tone pitch helpers */
const PITCH = {
  C4: 261.63,
  G3: 196.0,
  A1: 55.0,
};

/** Plays a short square-wave blip with a frequency glide. */
function playBlip(
  ctx: AudioContext,
  fromHz: number,
  toHz: number,
  durationMs: number,
  gain = 0.18,
) {
  const t0 = ctx.currentTime;
  const t1 = t0 + durationMs / 1000;
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(fromHz, t0);
  osc.frequency.exponentialRampToValueAtTime(toHz, t1);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t1);

  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t1 + 0.05);
}

/** Plays a low triangle-wave drone for ambience. */
function playDrone(ctx: AudioContext, hz: number, durationMs: number, gain = 0.12) {
  const t0 = ctx.currentTime;
  const t1 = t0 + durationMs / 1000;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(hz, t0);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.12);
  g.gain.linearRampToValueAtTime(0, t1);

  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t1 + 0.05);
}

/**
 * Fire the tomb-archive sound effect.
 * Composition:
 *   - 300ms C4 → G3 square blip (the "system has noticed" sting)
 *   - 1000ms A1 triangle drone underneath (the "you are gone" weight)
 * Both start at t=0 relative to invocation.
 */
export function playTombArchiveSfx(): void {
  const ctx = getCtx();
  if (!ctx) return;
  void unlockAudio();
  if (ctx.state !== "running") return;
  playBlip(ctx, PITCH.C4, PITCH.G3, 300);
  playDrone(ctx, PITCH.A1, 1000);
}
