"use client";

// v4 PSA video player.
// Reference: docs/v4-migration-plan.md Phase 1; project_v4 III. 背景故事
// - Auto-plays the 55-60s PSA on mount
// - Auto-advances at video end OR 60s timeout
// - [Skip ▶] button surfaces after 5s (prevents instant bail)
// - When no /psa.mp4 exists, falls back to a styled placeholder

import { useEffect, useRef, useState } from "react";

const SKIP_DELAY_MS = 5_000;
const HARD_TIMEOUT_MS = 60_000;

interface PSAPlayerProps {
  videoSrc?: string;     // /psa.mp4 once produced (Phase 11)
  onComplete: () => void; // called on video end / hard timeout / skip click
}

export function PSAPlayer({ videoSrc, onComplete }: PSAPlayerProps) {
  const [skipVisible, setSkipVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const completedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  // Show [Skip ▶] after 5s
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

  const showFallback = !videoSrc || videoFailed;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      {showFallback ? (
        <PSAFallback elapsed={elapsed} />
      ) : (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          playsInline
          muted={false}
          onEnded={complete}
          onError={() => setVideoFailed(true)}
          className="max-h-screen max-w-screen object-contain"
        />
      )}

      {/* Top-left meta */}
      <div className="absolute top-3 left-4 text-terminal-dim font-mono text-[10px] tracking-widest">
        PSA · EXPRESSION OPTIMIZATION SERVICE
      </div>
      <div className="absolute top-3 right-4 text-terminal-dim font-mono text-[10px]">
        {String(elapsed).padStart(2, "0")} / 60
      </div>

      {/* Skip button */}
      {skipVisible && (
        <button
          onClick={complete}
          className="absolute bottom-6 right-6 border border-terminal-green/60 text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-green/10 transition-colors"
        >
          Skip ▶
        </button>
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
    <div className="w-full h-full flex flex-col items-center justify-center px-8 text-center bg-black">
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
