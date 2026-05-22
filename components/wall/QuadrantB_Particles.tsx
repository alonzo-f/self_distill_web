"use client";

// v4 projection wall · Quadrant B · PARTICIPANT FIELD (top-left).
// Reference: docs/v4-migration-plan.md Phase 8 + Phase 9 (kill animation).
//
// v4 (2026-05-22, 修改0519.md item 1): the glyph-particle aura around each
// photo was hard to read on the projector. Switched to a clean photo-tile
// grid — same metadata (operator halo, kill animation, label) just without
// the symbolic cluster of ◉ / ◎ glyphs that orbited it.
//
// Previous behaviour preserved:
//   - Operator + current-user clusters get halos
//   - Any attack is a KILL: photo desaturates, cluster shakes, red ring
//     pulses around it. Red beam stays removed.
//   - "doomed" targets remain visible during the animation TTL even after
//     their DB row flips to status=ARCHIVED.

import { useMemo } from "react";
import type { WallParticipant } from "@/lib/participants/types";

export interface AttackEvent {
  id: string;
  sourceDisplayId: string;
  targetDisplayId: string;
  kind: "backdoor" | "operator";
  at: number;
}

interface QuadrantB_ParticlesProps {
  participants: WallParticipant[];
  currentUserDisplayId?: string;
  /** Active attack overlays. Each lives for ~ATTACK_TTL_MS then is removed by the parent. */
  activeAttacks?: AttackEvent[];
}

const MAX_VISIBLE = 30;

export function QuadrantB_Particles({
  participants,
  currentUserDisplayId,
  activeAttacks = [],
}: QuadrantB_ParticlesProps) {
  // Clusters being killed right now (so we keep them visible even after their
  // DB row flips to status=ARCHIVED — otherwise the animation never plays).
  const doomedDisplayIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of activeAttacks) s.add(a.targetDisplayId);
    return s;
  }, [activeAttacks]);

  const visible = participants
    .filter((p) => !p.isPermanent)
    .filter(
      (p) =>
        p.status !== "ARCHIVED" || doomedDisplayIds.has(p.displayId),
    )
    .slice(0, MAX_VISIBLE);

  return (
    <Panel label="PARTICIPANT FIELD">
      {visible.length === 0 ? (
        <div className="text-terminal-dim/40 text-[10px] italic h-full flex items-center justify-center">
          Awaiting participants...
        </div>
      ) : (
        <div className="relative h-full">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
            {visible.map((p) => (
              <ParticipantTile
                key={p.id}
                participant={p}
                isMe={p.displayId === currentUserDisplayId}
                isTargeted={doomedDisplayIds.has(p.displayId)}
              />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/**
 * v4 (2026-05-22): a single participant on the wall is now just their
 * photo + DisplayID label. No symbol orbit. Operator / current-user gets
 * a colored border halo; kill targets desaturate + shake with a red ring.
 */
function ParticipantTile({
  participant,
  isMe,
  isTargeted,
}: {
  participant: WallParticipant;
  isMe: boolean;
  isTargeted: boolean;
}) {
  const borderClass = isTargeted
    ? "border-terminal-red border-2"
    : isMe
      ? "border-terminal-green border-2"
      : participant.isOperator
        ? "border-amber-300 border-2"
        : "border-terminal-dim/40 border";

  return (
    <div
      className={`relative aspect-square flex flex-col items-center ${
        isTargeted ? "cluster-targeted" : ""
      }`}
    >
      {/* Photo tile */}
      <div
        className={`relative w-full aspect-square overflow-hidden ${borderClass} ${
          (participant.isOperator || isMe) && !isTargeted ? "animate-pulse" : ""
        }`}
      >
        {participant.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={participant.photoUrl}
            alt=""
            className="w-full h-full object-cover transition-[filter] duration-300"
            style={{
              transform: "scaleX(-1)",
              // Kill state — photo desaturates to B&W
              filter: isTargeted
                ? "grayscale(1) contrast(1.1) brightness(0.55)"
                : undefined,
            }}
          />
        ) : (
          <div className="w-full h-full bg-terminal-dim/10 flex items-center justify-center text-terminal-dim/40 text-[10px] font-mono">
            no photo
          </div>
        )}
        {/* v4 (2026-05-22, 修改0519.md item 7): red flash 3x when targeted */}
        {isTargeted && (
          <>
            <div className="absolute inset-0 bg-terminal-red/60 mix-blend-overlay attack-red-flash pointer-events-none" />
            <div className="absolute inset-0 border-2 border-terminal-red attack-target-ring pointer-events-none" />
          </>
        )}
      </div>

      {/* Label below */}
      <div className="mt-1 text-center text-terminal-dim text-[9px] font-mono truncate w-full">
        {participant.displayId}
      </div>

      <style jsx>{`
        @keyframes cluster-shake {
          0% { transform: translate(0, 0); }
          15% { transform: translate(-2px, 1px); }
          30% { transform: translate(2px, -1px); }
          45% { transform: translate(-1px, 2px); }
          60% { transform: translate(1px, -1px); }
          75% { transform: translate(-1px, 0); }
          100% { transform: translate(0, 0); }
        }
        @keyframes ring-pulse {
          0% { transform: scale(0.85); opacity: 0; }
          25% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        /* v4 (2026-05-22, 修改0519.md item 7): three discrete red flashes
           over ~1.5s. Each flash: 0→1→0 across roughly 1/6th of the
           timeline, with a quiet beat between flashes. */
        @keyframes red-flash {
          0%   { opacity: 0; }
          5%   { opacity: 1; }
          15%  { opacity: 0; }
          30%  { opacity: 0; }
          35%  { opacity: 1; }
          45%  { opacity: 0; }
          60%  { opacity: 0; }
          65%  { opacity: 1; }
          75%  { opacity: 0; }
          100% { opacity: 0; }
        }
        :global(.cluster-targeted) {
          animation: cluster-shake 0.6s ease-in-out 2;
        }
        :global(.attack-target-ring) {
          animation: ring-pulse 0.8s ease-out;
        }
        :global(.attack-red-flash) {
          animation: red-flash 1.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-terminal-border h-full p-2.5 flex flex-col">
      <div className="text-terminal-dim text-[10px] tracking-widest mb-2">{label}</div>
      <div className="flex-1 overflow-hidden relative">{children}</div>
    </div>
  );
}
