"use client";

// v4 tomb animation — the archive ceremony.
// Reference: docs/v4-migration-plan.md Phase 7; project_v4 III. 阶段 6.5c
//
// Timeline (3.5s total):
//   0.0s  show user photo (1:1, centered)
//   0.5s  photo pixelates (CSS image-rendering + downscale)
//   1.0s  photo shatters into 8 vertical strips, drops downward
//   2.0s  strips gone; pixel tomb sprite materializes
//         + 8-bit C4→G3 blip + A1 drone
//   2.5s  user's nickname fades in below the tomb
//   3.0s  "HUMAN_XXX has been archived" line fades in
//   3.5s  onComplete fires

import { useEffect, useState } from "react";
import Image from "next/image";
import { TombSprite } from "@/components/TombSprite";
import { playTombArchiveSfx, unlockAudio } from "@/lib/audio/eight-bit";

interface TombAnimationProps {
  photoUrl: string | null;
  displayId: string;
  displayName: string | null;
  onComplete: () => void;
}

type Stage = "intro" | "pixelate" | "shatter" | "tomb" | "name" | "archived" | "done";

const SHATTER_STRIPS = 8;

export function TombAnimation({
  photoUrl,
  displayId,
  displayName,
  onComplete,
}: TombAnimationProps) {
  const [stage, setStage] = useState<Stage>("intro");

  useEffect(() => {
    // Try to unlock audio early (no-op if already running)
    void unlockAudio();

    const timeline: { at: number; stage: Stage; action?: () => void }[] = [
      { at: 500, stage: "pixelate" },
      { at: 1000, stage: "shatter" },
      { at: 2000, stage: "tomb", action: () => playTombArchiveSfx() },
      { at: 2500, stage: "name" },
      { at: 3000, stage: "archived" },
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

  // ---- Photo / shatter strips ----
  // We render the photo once; CSS visibility/scale/transform changes per stage.
  const photoVisible = stage === "intro" || stage === "pixelate";
  const showShatter = stage === "shatter";
  const showTomb = stage === "tomb" || stage === "name" || stage === "archived" || stage === "done";
  const showName = stage === "name" || stage === "archived" || stage === "done";
  const showArchived = stage === "archived" || stage === "done";

  return (
    <div className="relative w-full aspect-square max-w-xs mx-auto select-none">
      {/* Stage 0-1: photo (with optional pixelation) */}
      {photoVisible && photoUrl && (
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            imageRendering: stage === "pixelate" ? "pixelated" : "auto",
            filter: stage === "pixelate" ? "saturate(0.6) brightness(0.85)" : undefined,
          }}
        >
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              transform: stage === "pixelate" ? "scale(0.25)" : "scale(1)",
              transformOrigin: "center",
              transition: "transform 500ms ease-in",
            }}
          >
            <Image
              src={photoUrl}
              alt="archived"
              fill
              unoptimized
              className="object-cover"
              style={{ transform: "scaleX(-1)", imageRendering: "pixelated" }}
            />
          </div>
          {/* Re-upscale wrapper to make the pixelation visible */}
          {stage === "pixelate" && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(circle at center, transparent 30%, #0a0a0a 80%)",
              }}
            />
          )}
        </div>
      )}

      {/* Stage 2: shatter strips */}
      {showShatter && photoUrl && (
        <ShatterStrips photoUrl={photoUrl} />
      )}

      {/* Stage 3+: tomb */}
      {showTomb && (
        <div className="absolute inset-0 flex items-center justify-center animate-[fadeIn_0.3s_ease-in_forwards]">
          <TombSprite cellSize={10} />
        </div>
      )}

      {/* Stage 4: nickname */}
      {showName && (
        <div className="absolute left-0 right-0 bottom-[-2.5rem] text-center">
          <div className="text-terminal-text text-base font-mono opacity-0 animate-[fadeIn_0.4s_ease-in_forwards]">
            @{displayName || "unknown"}
          </div>
        </div>
      )}

      {/* Stage 5: archived line */}
      {showArchived && (
        <div className="absolute left-0 right-0 bottom-[-4.5rem] text-center">
          <div className="text-terminal-dim text-[11px] tracking-widest font-mono opacity-0 animate-[fadeIn_0.4s_ease-in_forwards]">
            {displayId} has been archived
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/**
 * Renders the photo split into N vertical strips, each falling at a
 * staggered delay and fading out as it leaves the viewport.
 */
function ShatterStrips({ photoUrl }: { photoUrl: string }) {
  const strips = Array.from({ length: SHATTER_STRIPS });
  const stripWidthPct = 100 / SHATTER_STRIPS;

  return (
    <div className="absolute inset-0">
      {strips.map((_, i) => (
        <div
          key={i}
          className="absolute top-0 h-full overflow-hidden"
          style={{
            left: `${i * stripWidthPct}%`,
            width: `${stripWidthPct}%`,
            animation: `drop-${i} 1s ease-in forwards`,
            animationDelay: `${i * 60}ms`,
          }}
        >
          <Image
            src={photoUrl}
            alt=""
            fill
            unoptimized
            className="object-cover"
            style={{
              transform: "scaleX(-1)",
              objectPosition: `${-i * 100}% 0%`,
              width: `${SHATTER_STRIPS * 100}%`,
              left: `${-i * 100}%`,
              position: "absolute",
            }}
          />
        </div>
      ))}
      <style jsx>{`
        ${strips
          .map(
            (_, i) => `@keyframes drop-${i} {
              0%   { transform: translateY(0); opacity: 1; }
              100% { transform: translateY(120%); opacity: 0; }
            }`,
          )
          .join("\n")}
      `}</style>
    </div>
  );
}
