// v4 8-bit audio library — shared SFX across the experience.
// Reference: docs/v4-migration-plan.md Phase 7; project_v4 III. 阶段 6.5c
//
// Uses the native Web Audio API (no Tone.js dependency). Each named SFX
// composes the same primitives (square blip, triangle drone, noise burst,
// ascending arpeggio) so the whole soundscape feels coherent — like a
// single chip is voicing everything.
//
// v4 (2026-05-22) additions per user request:
//   playSubmitSfx        — answer submitted on /task
//   playWarningSfx       — /mine overload + /benchmark low-rating warning
//   playMineTickSfx      — quiet click on /mine (every successful click)
//   playMineErrorSfx     — /mine click that landed on an error
//   playDistillReadySfx  — /distill reveal complete
//   playLeisureUnlockSfx — first entry into /leisure
//   playBetSfx           — every /leisure/{game} bet placed
//   playWinSfx           — gambling win
//   playLossSfx          — gambling loss
//   playBackdoorOpenSfx  — first entry into /backdoor (the ceremony)
//   playAttackSfx        — /backdoor/attack action executed
//   playClickSfx         — generic short tick fired by GlobalClickSfx
//                          on every <button> press (camera capture, skip,
//                          consent, "continue", etc.). Subtle enough to
//                          layer under the more specific SFX above.
//   playDistilledRevealSfx  — /verdict reveal, DISTILLED outcome
//   playVesselPreservedSfx  — /verdict reveal, VESSEL_PRESERVED outcome

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
  // Octave 1 — sub bass for weight
  A1: 55.0,
  // Octave 2 — bass
  E2: 82.41,
  G2: 98.0,
  A2: 110.0,
  // Octave 3
  C3: 130.81,
  E3: 164.81,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  // Octave 4
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
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

/** White-noise burst (filtered) — for clicks / coin-drops / impacts. */
function playNoise(ctx: AudioContext, durationMs: number, gain = 0.1, filterHz = 1200) {
  const t0 = ctx.currentTime;
  const t1 = t0 + durationMs / 1000;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * (durationMs / 1000)));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filt = ctx.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = filterHz;
  filt.Q.value = 1.2;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t1);

  src.connect(filt);
  filt.connect(g);
  g.connect(ctx.destination);
  src.start(t0);
  src.stop(t1 + 0.02);
}

/** Schedule a chain of square-wave notes (an arpeggio). */
function playArpeggio(
  ctx: AudioContext,
  notes: number[],
  perNoteMs: number,
  gain = 0.16,
  glide = false,
) {
  for (let i = 0; i < notes.length; i++) {
    const at = ctx.currentTime + (i * perNoteMs) / 1000;
    const t1 = at + perNoteMs / 1000;
    const osc = ctx.createOscillator();
    osc.type = "square";
    if (glide && i > 0) {
      osc.frequency.setValueAtTime(notes[i - 1], at);
      osc.frequency.exponentialRampToValueAtTime(notes[i], t1);
    } else {
      osc.frequency.setValueAtTime(notes[i], at);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(at);
    osc.stop(t1 + 0.03);
  }
}

/**
 * Internal helper: fire SFX through the shared audio context.
 *
 * v4 (2026-05-22): no longer bails when ctx.state !== "running". The
 * previous early-exit silently dropped the first SFX after route
 * transitions on iOS, where the context briefly drops back to
 * "suspended" or "interrupted" mid-navigation. WebAudio safely queues
 * oscillators scheduled while suspended — they play as soon as resume()
 * completes — so it's better to schedule unconditionally and let the
 * Promise from resume() catch up.
 */
function withCtx(fn: (ctx: AudioContext) => void): void {
  const ctx = getCtx();
  if (!ctx) return;
  // Fire-and-forget resume. Returns a Promise; we don't await — the
  // oscillators we schedule below will play once it settles.
  void unlockAudio();
  fn(ctx);
}

// ───────────────────────────────────────────────────────────────────────
// Named SFX
// ───────────────────────────────────────────────────────────────────────

/**
 * Fire the tomb-archive sound effect.
 * Composition:
 *   - 300ms C4 → G3 square blip (the "system has noticed" sting)
 *   - 1000ms A1 triangle drone underneath (the "you are gone" weight)
 */
export function playTombArchiveSfx(): void {
  withCtx((ctx) => {
    playBlip(ctx, PITCH.C4, PITCH.G3, 300);
    playDrone(ctx, PITCH.A1, 1000);
  });
}

/** /task — answer submitted. Two-note ascending confirmation: G4 → C5. */
export function playSubmitSfx(): void {
  withCtx((ctx) => {
    playArpeggio(ctx, [PITCH.G4, PITCH.C5], 110, 0.18);
  });
}

/** /mine overload + /benchmark low-rating warning. Dissonant minor 2nd. */
export function playWarningSfx(): void {
  withCtx((ctx) => {
    // Two interleaved descending tones with slightly clashing intervals.
    playBlip(ctx, PITCH.E4, PITCH.C4, 180, 0.16);
    playBlip(ctx, PITCH.A3, PITCH.G3, 240, 0.14);
    playDrone(ctx, PITCH.A1, 350, 0.08);
  });
}

/** /mine — successful click. Very short, low volume — fires many times. */
export function playMineTickSfx(): void {
  withCtx((ctx) => {
    playNoise(ctx, 45, 0.06, 2200);
    playBlip(ctx, PITCH.E5, PITCH.G5, 50, 0.05);
  });
}

/** /mine — click landed on an error. Sharper, descending. */
export function playMineErrorSfx(): void {
  withCtx((ctx) => {
    playNoise(ctx, 80, 0.1, 600);
    playBlip(ctx, PITCH.A3, PITCH.E3, 120, 0.16);
  });
}

/** /distill — reveal complete. Slow, calm: C4 → E4 → G4 over 600 ms. */
export function playDistillReadySfx(): void {
  withCtx((ctx) => {
    playArpeggio(ctx, [PITCH.C4, PITCH.E4, PITCH.G4], 180, 0.14);
  });
}

/** /leisure — first-time unlock. Bright C major triad up + a glittery noise. */
export function playLeisureUnlockSfx(): void {
  withCtx((ctx) => {
    playArpeggio(ctx, [PITCH.C4, PITCH.E4, PITCH.G4, PITCH.C5], 100, 0.18);
    setTimeout(() => playNoise(ctx, 200, 0.08, 3200), 250);
  });
}

/** /leisure/{game} — bet placed. Coin-drop feel. */
export function playBetSfx(): void {
  withCtx((ctx) => {
    playNoise(ctx, 50, 0.09, 4000);
    playBlip(ctx, PITCH.G4, PITCH.E4, 90, 0.13);
  });
}

/** /leisure/{game} — win. Rising arpeggio + sub-bass hit. */
export function playWinSfx(): void {
  withCtx((ctx) => {
    playArpeggio(ctx, [PITCH.E4, PITCH.G4, PITCH.C5, PITCH.E5], 90, 0.18);
    playDrone(ctx, PITCH.A2, 300, 0.08);
  });
}

/** /leisure/{game} — loss. Descending blip + low drone. */
export function playLossSfx(): void {
  withCtx((ctx) => {
    playBlip(ctx, PITCH.E4, PITCH.A3, 280, 0.16);
    playDrone(ctx, PITCH.A1, 400, 0.1);
  });
}

/** /backdoor — first entry. The ceremony hit: long ascending + heavy bass. */
export function playBackdoorOpenSfx(): void {
  withCtx((ctx) => {
    // Slow ascending fifth pattern
    playArpeggio(ctx, [PITCH.C3, PITCH.G3, PITCH.C4, PITCH.G4, PITCH.C5], 170, 0.18, true);
    // Sub bass underneath
    playDrone(ctx, PITCH.A1, 1500, 0.14);
    // Final shimmer
    setTimeout(() => playNoise(ctx, 400, 0.07, 4500), 700);
  });
}

/**
 * Generic button-press tick. Very short (~40 ms), low volume — designed
 * to be fired by the GlobalClickSfx listener on every <button> click
 * without overwhelming the more specific action SFX that may also fire.
 */
export function playClickSfx(): void {
  withCtx((ctx) => {
    playBlip(ctx, PITCH.A4, PITCH.D4, 35, 0.07);
  });
}

/**
 * /verdict — DISTILLED outcome. Triumphant ascending arpeggio + bright
 * sub-bass + shimmer noise. Reads as "system approves of you" — but the
 * undercurrent is the inversion the piece is about, so we keep the
 * triumph clean and just slightly cold (no romantic chord, just a clear
 * major arpeggio).
 */
export function playDistilledRevealSfx(): void {
  withCtx((ctx) => {
    playArpeggio(ctx, [PITCH.C4, PITCH.E4, PITCH.G4, PITCH.C5, PITCH.E5], 130, 0.18);
    playDrone(ctx, PITCH.A2, 1200, 0.1);
    setTimeout(() => playNoise(ctx, 300, 0.06, 5000), 700);
  });
}

/**
 * /verdict — VESSEL_PRESERVED outcome. Soft descending minor figure +
 * long low drone. Reads as "rejection, but politely". Per the piece's
 * tone — the system never raises its voice.
 */
export function playVesselPreservedSfx(): void {
  withCtx((ctx) => {
    // Descending B3 → G3 → E3 (a downward minor 6th feel)
    playArpeggio(ctx, [PITCH.B3, PITCH.G3, PITCH.E3], 220, 0.15);
    // Long low drone — the "you are inefficient" weight
    playDrone(ctx, PITCH.A1, 1600, 0.12);
    // A late single muted blip — the "filed away" beat
    setTimeout(() => {
      withCtx((c) => playBlip(c, PITCH.E3, PITCH.C3, 200, 0.1));
    }, 1100);
  });
}

/** /backdoor/attack — token executed. Brutal kick + descending sting. */
export function playAttackSfx(): void {
  withCtx((ctx) => {
    // Kick: short noise burst at low filter
    playNoise(ctx, 70, 0.18, 200);
    // Descending sting
    playBlip(ctx, PITCH.E4, PITCH.A2, 220, 0.18);
    // Sub-bass tail
    playDrone(ctx, PITCH.E2, 500, 0.12);
  });
}
