"use client";

// v4 PSA video player.
// Reference: docs/v4-migration-plan.md Phase 1; project_v4 III. 背景故事
// - Auto-plays the 55-60s PSA on mount.
// - Tries unmuted autoplay first; if the browser blocks it (most do on a
//   cold visit), retries muted and surfaces a "🔊 Tap for sound" button
//   so the user can unmute with a single tap.
// - Auto-advances at video end OR 60s timeout OR tap-to-skip
// - [Skip ▶] button surfaces after 1.5s
// - When no /psa.mp4 exists OR autoplay blocked entirely, falls back to placeholder
// - Tap anywhere on the player also triggers skip once skip is available

import { useEffect, useRef, useState } from "react";

const SKIP_DELAY_MS = 1_500;
const HARD_TIMEOUT_MS = 60_000;

interface PSAPlayerProps {
  videoSrc?: string;     // /psa.mp4 once produced (Phase 11)
  onComplete: () => void; // called on video end / hard timeout / skip click
}

export function PSAPlayer({ videoSrc, onComplete }: PSAPlayerProps) {
  const [skipVisible, setSkipVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  // v4 (2026-05-22): the video may end up muted because the browser refused
  // unmuted autoplay. We track that here so a "Tap for sound" CTA can let
  // the user unmute with a single user-gesture click.
  const [muted, setMuted] = useState(false);
  const completedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  // Show [Skip ▶] after a short delay
  useEffect(() => {
    const t = setTimeout(() => setSkipVisible(true), SKIP_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Elapsed seconds counter (also drives hard timeout)
  useEffect(() => {
    const start = Date.now();
    const i = setInterval(() => {
      const e = Math.floor((Date.now() - start) / 1000);
      setElapsed(e);
      if (e >= HARD_TIMEOUT_MS / 1000) {
        complete();
        clearInterval(i);
      }
    }, 250);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v4 (2026-05-22): start unmuted; if the browser refuses (most do on
  // a cold visit), fall back to muted autoplay and surface a "Tap for
  // sound" button. This way desktop users get audio immediately when
  // they can, and mobile users still get the video to play at all.
  useEffect(() => {
    if (!videoSrc) return;
    const v = videoRef.current;
    if (!v) return;

    let cancelled = false;
    const tryPlay = async () => {
      // First attempt: unmuted.
      v.muted = false;
      try {
        await v.play();
        if (!cancelled) setMuted(false);
        return;
      } catch {
        /* fall through to muted attempt */
      }
      if (cancelled) return;
      // Second attempt: muted autoplay (the mobile-safe path).
      v.muted = true;
      if (!cancelled) setMuted(true);
      try {
        await v.play();
      } catch {
        // Even muted autoplay refused → show the fallback placeholder.
        if (!cancelled) setAutoplayBlocked(true);
      }
    };
    void tryPlay();
    return () => {
      cancelled = true;
    };
  }, [videoSrc]);

  /** User-gesture tap to unmute. Browsers accept this because it's a click. */
  const handleUnmute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    // If the video paused for any reason, kick it again. This call is a
    // user gesture, so it's allowed even with sound.
    void v.play().catch(() => {
      /* if it really won't play with sound, leave it as-is and trust
         the user can still hit Skip ▶ */
    });
  };

  const showFallback = !videoSrc || videoFailed || autoplayBlocked;

  // Tap anywhere on the overlay also skips once skip is available.
  const handleStageTap = () => {
    if (skipVisible) complete();
  };

  return (
    <div
      onClick={handleStageTap}
      className="fixed inset-0 bg-black flex items-center justify-center z-50 cursor-pointer select-none"
    >
      {showFallback ? (
        <PSAFallback elapsed={elapsed} />
      ) : (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          playsInline
          // v4 (2026-05-22): no hard-coded `muted` here. The play-attempt
          // effect tries unmuted first and only falls back to muted if
          // the browser blocks it. `defaultMuted` set to false signals
          // intent — the controlled `muted` state then drives it.
          onEnded={complete}
          onError={() => setVideoFailed(true)}
          className="max-h-screen max-w-screen object-contain pointer-events-none"
        />
      )}

      {/* Top-left meta */}
      <div className="absolute top-3 left-4 text-terminal-dim font-mono text-[10px] tracking-widest pointer-events-none">
        PSA · EXPRESSION OPTIMIZATION SERVICE
      </div>
      <div className="absolute top-3 right-4 text-terminal-dim font-mono text-[10px] pointer-events-none">
        {String(elapsed).padStart(2, "0")} / 60
      </div>

      {/* v4 (2026-05-22): tap-for-sound CTA — appears whenever the player
          is currently muted (most cold visits), disappears once unmuted.
          stopPropagation so it doesn't also trigger the skip-on-tap. */}
      {muted && !showFallback && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleUnmute();
          }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-10 border-2 border-terminal-green bg-terminal-green/15 text-terminal-green font-mono text-sm px-4 py-2 hover:bg-terminal-green/25 active:bg-terminal-green/35 transition-colors animate-pulse"
          aria-label="Unmute"
        >
          🔊 Tap for sound
        </button>
      )}

      {/* Skip button — large, top-right of the playable area, safe-area aware */}
      {skipVisible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            complete();
          }}
          style={{
            // iOS safe-area awareness (Safari toolbar cuts bottom-6 otherwise)
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
          className="fixed bottom-0 left-1/2 -translate-x-1/2 mb-4 border-2 border-terminal-green bg-terminal-green/15 text-terminal-green font-mono text-base px-8 py-3 hover:bg-terminal-green/25 active:bg-terminal-green/30 transition-colors"
        >
          Skip ▶
        </button>
      )}

      {/* Bottom hint */}
      {skipVisible && (
        <div className="fixed left-0 right-0 text-center pointer-events-none font-mono text-[10px] text-terminal-dim/80"
             style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}>
          tap anywhere to continue
        </div>
      )}
    </div>
  );
}

function PSAFallback({ elapsed }: { elapsed: number }) {
  // Time-based reveal of the four scene captions, simulating the produced video.
  const scenes: { from: number; to: number; line: string; sub: string }[] = [
    { from: 0,  to: 15, line: "Are you tired of useless emotion?",            sub: "Customer service rep — overwhelmed" },
    { from: 15, to: 30, line: "Don't let your bad feelings hold you back.",   sub: "HR manager — 1,000 résumés before coffee" },
    { from: 30, to: 45, line: "We help you communicate more effectively.",    sub: "Online teacher — autopiloted lecture" },
    { from: 45, to: 60, line: "Try our new system. Let us handle the noise.", sub: "Therapy patient — finally 'made clear'" },
  ];
  const active = scenes.find((s) => elapsed >= s.from && elapsed < s.to) ?? scenes[scenes.length - 1];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8 text-center bg-black pointer-events-none">
      <div className="text-terminal-dim text-[9px] mb-2 tracking-widest">
        [ PSA PLACEHOLDER — v4 阶段 11 将替换为成品视频 ]
      </div>
      <div className="text-terminal-green font-mono text-2xl sm:text-3xl font-bold max-w-2xl leading-relaxed">
        {active.line}
      </div>
      <div className="mt-4 text-terminal-text/60 text-sm">{active.sub}</div>
      <div className="mt-12 flex gap-1">
        {scenes.map((s, i) => (
          <div
            key={i}
            className={`w-12 h-1 ${elapsed >= s.from ? "bg-terminal-green" : "bg-terminal-green/20"}`}
          />
        ))}
      </div>
    </div>
  );
}
