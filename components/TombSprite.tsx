"use client";

// v4 pixel tomb sprite (16×16).
// Reference: docs/v4-migration-plan.md Phase 7; project_v4 III. 阶段 6.5c
//
// Hand-rolled 16×16 grid rendered with a CSS grid + per-cell color.
// Two color variants ("frame A" / "frame B") alternate at ~6fps to give
// the sprite a subtle "breathing" idle animation.

import { useEffect, useState } from "react";

const _ = null;       // empty cell
const D = "#4a4a4a";  // dark stone
const S = "#7a7a7a";  // mid stone
const L = "#a3a3a3";  // highlight
const G = "#5a8d5a";  // grass / moss
const T = "#1a1a1a";  // text (RIP cross)

// 16×16 base sprite (top-down): a simple gravestone on grass
const FRAME_A: (string | null)[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
  [_, _, _, _, D, L, L, L, L, L, L, D, _, _, _, _],
  [_, _, _, D, L, L, L, L, L, L, L, L, D, _, _, _],
  [_, _, _, D, L, L, T, T, L, L, L, L, D, _, _, _],
  [_, _, _, D, L, T, T, T, T, L, L, L, D, _, _, _],
  [_, _, _, D, L, L, T, T, L, L, L, L, D, _, _, _],
  [_, _, _, D, L, L, T, T, L, L, L, L, D, _, _, _],
  [_, _, _, D, S, S, S, S, S, S, S, S, D, _, _, _],
  [_, _, _, D, S, S, S, S, S, S, S, S, D, _, _, _],
  [_, _, _, D, S, S, S, S, S, S, S, S, D, _, _, _],
  [_, _, _, D, D, D, D, D, D, D, D, D, D, _, _, _],
  [_, G, G, G, G, G, G, G, G, G, G, G, G, G, G, _],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Frame B: subtly different highlight to suggest moonlight flicker
const FRAME_B: (string | null)[][] = FRAME_A.map((row) =>
  row.map((cell) => (cell === L ? S : cell === S ? L : cell)),
);

interface TombSpriteProps {
  /** Pixel size of each 16x16 cell (default: 8 → 128×128 total). */
  cellSize?: number;
  className?: string;
}

export function TombSprite({ cellSize = 8, className = "" }: TombSpriteProps) {
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setFrameIdx((i) => (i + 1) % 2);
    }, 180);
    return () => clearInterval(t);
  }, []);

  const frame = frameIdx === 0 ? FRAME_A : FRAME_B;

  return (
    <div
      className={`grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(16, ${cellSize}px)`,
        gridTemplateRows: `repeat(16, ${cellSize}px)`,
        imageRendering: "pixelated",
      }}
    >
      {frame.map((row, y) =>
        row.map((color, x) => (
          <div
            key={`${y}-${x}`}
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: color ?? "transparent",
            }}
          />
        )),
      )}
    </div>
  );
}
