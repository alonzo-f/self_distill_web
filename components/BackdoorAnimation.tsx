"use client";

// v4 backdoor settlement animation — the fusion ceremony.
// Reference: docs/v4-migration-plan.md Phase 9; project_v4 III. 阶段 6.7b
//
// Timeline (~4s total):
//   0.0s  user photo at top, BUILDER_01 / BUILDER_02 clusters visible at bottom
//   0.5s  photo splits into a 6×6 = 36 tile grid
//   1.0s  tiles each begin a drift toward the foundation row, opacity easing down
//   2.5s  tiles arrive, last bit of opacity fades; foundation row briefly pulses
//   3.0s  text fades in:
//          "You found the backdoor.
//           But the backdoor was a door, not an exit.
//           Your identity is now part of the system's foundation."
//   3.5s  onComplete fires; parent reveals the [Confirm] flow

import { useEffect, useState } from "react";
import Image from "next/image";

interface BackdoorAnimationProps {
  photoUrl: string | null;
  builderRoles: { id: string; role: string }[]; // e.g. [{id:"BUILDER_01", role:"编剧/导演"}, ...]
  onComplete: () => void;
}

type Stage = "intro" | "tile" | "drift" | "merge" | "text" | "done";

// v4 (2026-05-22): denser tile grid for a stronger particle dissolve.
// 6×6 (36 tiles) felt blocky; 14×14 (196 tiles) reads as proper "particles".
const TILES_PER_AXIS = 14;
const TILE_COUNT = TILES_PER_AXIS * TILES_PER_AXIS;

export function BackdoorAnimation({
  photoUrl,
  builderRoles,
  onComplete,
}: BackdoorAnimationProps) {
  const [stage, setStage] = useState<Stage>("intro");

  useEffect(() => {
    const timeline: { at: number; stage: Stage; action?: () => void }[] = [
      { at: 500, stage: "tile" },
      { at: 1000, stage: "drift" },
      { at: 2500, stage: "merge" },
      { at: 3000, stage: "text" },
      { at: 3500, stage: "done", action: onComplete },
    ];
    const timers = timeline.map(({ at, stage: s, action }) =>
      window.setTimeout(() => {
        setStage(s);
        action?.();
      }, at),
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [onComplete]);

  const photoVisible = stage === "intro";
  const showTiles = stage === "tile" || stage === "drift" || stage === "merge";
  const showText = stage === "text" || stage === "done";

  return (
    <div className="relative w-full h-[420px] overflow-hidden">
      {/* User photo (intro) */}
      {photoVisible && photoUrl && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-32 border border-terminal-green/60 overflow-hidden">
          <Image
            src={photoUrl}
            alt=""
            width={128}
            height={128}
            unoptimized
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>
      )}

      {/* Tile grid (split → drift → merge) */}
      {showTiles && photoUrl && (
        <TileGrid
          photoUrl={photoUrl}
          drifting={stage === "drift" || stage === "merge"}
        />
      )}

      {/* Foundation row (always visible) */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center items-end gap-6">
        {builderRoles.map((b) => (
          <div
            key={b.id}
            className={`flex flex-col items-center ${
              stage === "merge" || stage === "text" || stage === "done"
                ? "animate-pulse"
                : ""
            }`}
          >
            <div className="w-16 h-16 border-2 border-amber-300/60 bg-amber-300/10 flex items-center justify-center text-amber-300/80 text-[10px] font-bold">
              {b.id}
            </div>
            <div className="text-amber-300/60 text-[9px] font-mono mt-1">
              {b.role}
            </div>
          </div>
        ))}
      </div>

      {/* Text overlay */}
      {showText && (
        <div className="absolute inset-x-0 top-2 text-center px-6 opacity-0 animate-[fadeInUp_0.5s_ease-in_forwards]">
          <div className="text-terminal-green text-xs font-mono leading-relaxed space-y-1">
            <p>You found the backdoor.</p>
            <p>But the backdoor was a door, not an exit.</p>
            <p className="text-terminal-amber">
              Your identity is now part of the system&apos;s foundation.
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Renders the photo as a 6×6 grid of background-positioned tiles, then
 * staggers a drift animation that ends near the bottom-center foundation.
 */
function TileGrid({
  photoUrl,
  drifting,
}: {
  photoUrl: string;
  drifting: boolean;
}) {
  const tiles = Array.from({ length: TILE_COUNT });
  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-32"
      style={{ pointerEvents: "none" }}
    >
      {tiles.map((_, i) => {
        const row = Math.floor(i / TILES_PER_AXIS);
        const col = i % TILES_PER_AXIS;
        // v4: with 196 tiles we want a longer stagger window so the dissolve
        // reads as a steady particle stream rather than one big drop.
        const delay = (i * 7) % 900;
        // Wider horizontal jitter so tiles disperse like real particles
        const xJitter = ((i * 53) % 90) - 45;
        // All tiles drift roughly straight down toward y ≈ 300px
        const targetY = drifting ? 280 - row * 2 : 0;
        const targetX = drifting ? xJitter : 0;
        const opacity = drifting ? 0 : 0.95;
        const tileSize = 128 / TILES_PER_AXIS;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              top: `${row * tileSize}px`,
              left: `${col * tileSize}px`,
              width: `${tileSize}px`,
              height: `${tileSize}px`,
              backgroundImage: `url(${photoUrl})`,
              backgroundSize: "128px 128px",
              backgroundPosition: `-${col * tileSize}px -${row * tileSize}px`,
              transform: `translate(${targetX}px, ${targetY}px) scaleX(-1)`,
              transition: `transform 1.5s ease-in ${delay}ms, opacity 1.5s ease-in ${delay}ms`,
              opacity,
              imageRendering: "pixelated",
              filter: drifting ? "saturate(0.6) brightness(0.85)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
