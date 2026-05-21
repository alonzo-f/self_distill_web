"use client";

// v4 distillation success animation.
// Reference: docs/v4-migration-plan.md Phase 5 (verdict reveal);
//            project_v4 III. 阶段 5 (DISTILLED outcome)
//
// Narrative:
//   The user has been judged "compressible into an algorithm." The original
//   photo dissolves and re-organizes as a sterile 8×8 green-dot lattice —
//   the user has been turned into structured data.
//
// Timeline (~3.5s):
//   0.0s  intro       — photo whole, slight inner glow
//   0.7s  dissolve    — photo pixelates + dims + slowly blurs
//   1.4s  particles   — 64 green dots emerge at random positions across the
//                       photo plane, opacity 0.7
//   2.8s  settled     — dots have drifted to their fixed 8×8 grid slots,
//                       photo gone, full opacity, slight pulse
//   3.5s  done        — onComplete fires

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Stage = "intro" | "dissolve" | "particles" | "settled" | "done";

const PARTICLE_COUNT = 64;
const GRID_SIZE = 8;        // 8×8
const BOX_PX = 128;         // animation canvas size
const PARTICLE_PX = 4;      // size of each lattice dot

interface DistillationAnimationProps {
  photoUrl: string | null;
  onComplete: () => void;
}

export function DistillationAnimation({
  photoUrl,
  onComplete,
}: DistillationAnimationProps) {
  const [stage, setStage] = useState<Stage>("intro");

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage("dissolve"), 700),
      window.setTimeout(() => setStage("particles"), 1400),
      window.setTimeout(() => setStage("settled"), 2800),
      window.setTimeout(() => {
        setStage("done");
        onComplete();
      }, 3500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Compute particle start (random within box) + end (grid slot) positions.
  // Stable across renders via deterministic hash so the dance doesn't jitter.
  const particles = useMemo(() => {
    const cell = (BOX_PX - PARTICLE_PX) / (GRID_SIZE - 1);
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const row = Math.floor(i / GRID_SIZE);
      const col = i % GRID_SIZE;
      const targetX = Math.round(col * cell);
      const targetY = Math.round(row * cell);
      const seed = fnvHash(`distill-${i}`);
      const randX = seed % (BOX_PX - PARTICLE_PX);
      const randY = (seed >> 8) % (BOX_PX - PARTICLE_PX);
      const delay = (i * 14) % 700;
      return { targetX, targetY, randX, randY, delay };
    });
  }, []);

  const showPhoto = stage === "intro" || stage === "dissolve";
  const showParticles =
    stage === "particles" || stage === "settled" || stage === "done";
  const settled = stage === "settled" || stage === "done";

  return (
    <div
      className="relative mx-auto"
      style={{ width: BOX_PX, height: BOX_PX }}
    >
      {/* Photo layer (intro + dissolve) */}
      {showPhoto && photoUrl && (
        <div
          className="absolute inset-0 overflow-hidden border-2 border-terminal-green"
          style={{
            transition: "opacity 0.6s ease, filter 0.6s ease",
            opacity: stage === "dissolve" ? 0.15 : 1,
          }}
        >
          <Image
            src={photoUrl}
            alt=""
            width={BOX_PX}
            height={BOX_PX}
            unoptimized
            className="w-full h-full object-cover"
            style={{
              transform: "scaleX(-1)",
              imageRendering: stage === "dissolve" ? "pixelated" : "auto",
              filter:
                stage === "dissolve"
                  ? "blur(3px) saturate(0.3) brightness(0.8) hue-rotate(85deg)"
                  : "none",
              transition: "filter 0.7s ease",
            }}
          />
          {/* Scanline glow during intro */}
          {stage === "intro" && (
            <div className="absolute inset-0 pointer-events-none distill-scan" />
          )}
        </div>
      )}

      {/* Particle lattice (particles + settled + done) */}
      {showParticles && (
        <div className="absolute inset-0 border-2 border-terminal-green bg-terminal-bg/80">
          {particles.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-terminal-green"
              style={{
                width: PARTICLE_PX,
                height: PARTICLE_PX,
                left: 0,
                top: 0,
                transform: settled
                  ? `translate(${p.targetX}px, ${p.targetY}px) scale(1)`
                  : `translate(${p.randX}px, ${p.randY}px) scale(0.6)`,
                opacity: settled ? 1 : 0.5,
                boxShadow: settled ? "0 0 4px rgba(0, 255, 65, 0.6)" : "none",
                transition: `transform 1.2s cubic-bezier(0.22, 0.61, 0.36, 1) ${p.delay}ms, opacity 0.8s ease ${p.delay}ms, box-shadow 0.6s ease ${p.delay}ms`,
              }}
            />
          ))}

          {/* Final state: gentle synchronized pulse on the entire lattice */}
          {settled && (
            <div className="absolute inset-0 distill-pulse pointer-events-none" />
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes distill-scan-keys {
          0%   { transform: translateY(-100%); opacity: 0; }
          50%  { opacity: 0.6; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        :global(.distill-scan) {
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(0, 255, 65, 0.25) 50%,
            transparent 100%
          );
          height: 24px;
          animation: distill-scan-keys 0.7s ease-in-out infinite;
        }
        @keyframes distill-pulse-keys {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(0, 255, 65, 0); }
          50%      { box-shadow: inset 0 0 18px 1px rgba(0, 255, 65, 0.35); }
        }
        :global(.distill-pulse) {
          animation: distill-pulse-keys 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/** FNV-1a hash for stable deterministic particle positions. */
function fnvHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
