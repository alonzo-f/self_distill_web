"use client";

// v4 projection wall · Quadrant B · PARTICIPANT FIELD (top-left).
// Reference: docs/v4-migration-plan.md Phase 8 + Phase 9 (kill animation).
//
// Each active participant becomes a small cluster of glyphs anchored around
// the centroid of their photo thumbnail. Operator + current-user clusters
// get halos.
//
// v4 (user-driven update): any attack is now a KILL.
//   - target photo desaturates to grayscale during the visual window
//   - cluster shakes (cluster-shake keyframe) + red ring pulses (ring-pulse)
//   - red beam removed per user request
//   - "doomed" targets remain visible during the animation TTL even after
//     their DB row flips to status=ARCHIVED, so the kill plays out instead
//     of the cluster vanishing instantly when participants refetch.

import { useMemo, useRef } from "react";
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

const PARTICLES_PER_CLUSTER = 8;
const MAX_VISIBLE = 30;

function symbolFor(p: WallParticipant): string {
  if (p.status === "LEISURE") return "░";
  if (p.status === "OPERATING") return "★";
  if (p.verdict === "DISTILLED") return "◉";
  return "◎";
}

function colorFor(p: WallParticipant, isMe: boolean): string {
  if (isMe) return "text-terminal-green";
  if (p.isOperator) return "text-amber-300";
  if (p.status === "LEISURE") return "text-terminal-dim/40";
  if (p.verdict === "DISTILLED") return "text-terminal-green/80";
  return "text-terminal-text/70";
}

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

  // Ref map kept for future use (e.g. tooltip on hover). Beam rendering removed.
  const clusterRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  return (
    <Panel label="PARTICIPANT FIELD">
      {visible.length === 0 ? (
        <div className="text-terminal-dim/40 text-[10px] italic h-full flex items-center justify-center">
          Awaiting participants...
        </div>
      ) : (
        <div className="relative h-full">
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
            {visible.map((p) => (
              <ParticleCluster
                key={p.id}
                participant={p}
                isMe={p.displayId === currentUserDisplayId}
                isTargeted={doomedDisplayIds.has(p.displayId)}
                refSetter={(el) => {
                  if (el) clusterRefs.current.set(p.displayId, el);
                  else clusterRefs.current.delete(p.displayId);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ParticleCluster({
  participant,
  isMe,
  isTargeted,
  refSetter,
}: {
  participant: WallParticipant;
  isMe: boolean;
  isTargeted: boolean;
  refSetter: (el: HTMLDivElement | null) => void;
}) {
  // Deterministic random offsets so a given user's cluster shape is stable
  // across re-renders (avoid jitter when realtime updates fire).
  const offsets = useMemo(() => {
    return Array.from({ length: PARTICLES_PER_CLUSTER }, (_, i) => {
      const seed = hashSeed(`${participant.id}-${i}`);
      const angle = (seed % 360) * (Math.PI / 180);
      const radius = 10 + ((seed >> 4) % 14);
      return {
        dx: Math.cos(angle) * radius,
        dy: Math.sin(angle) * radius,
      };
    });
  }, [participant.id]);

  const sym = symbolFor(participant);
  const colorClass = colorFor(participant, isMe);
  const showHalo = participant.isOperator || isMe;

  return (
    <div
      ref={refSetter}
      className={`relative aspect-square flex items-center justify-center ${
        isTargeted ? "cluster-targeted" : ""
      }`}
    >
      {/* Halo for operators / current user */}
      {showHalo && !isTargeted && (
        <div
          className={`absolute inset-1 rounded-full border ${
            isMe ? "border-terminal-green/70" : "border-amber-300/70"
          } animate-pulse`}
        />
      )}
      {/* Red attack halo when targeted */}
      {isTargeted && (
        <div className="absolute inset-0 rounded-full border-2 border-terminal-red attack-target-ring" />
      )}
      {/* Photo nucleus */}
      <div
        className={`relative z-10 w-7 h-7 border overflow-hidden ${
          isTargeted ? "border-terminal-red" : "border-terminal-dim/40"
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
              // v4 (user-driven update): kill state — photo desaturates to B&W
              filter: isTargeted
                ? "grayscale(1) contrast(1.1) brightness(0.55)"
                : undefined,
            }}
          />
        ) : (
          <div className="w-full h-full bg-terminal-dim/10" />
        )}
      </div>
      {/* Glyph particles around the photo */}
      {offsets.map((o, i) => (
        <span
          key={i}
          className={`absolute text-[10px] pointer-events-none ${colorClass}`}
          style={{
            transform: `translate(${o.dx}px, ${o.dy}px)`,
            opacity: 0.6 + ((i % 4) * 0.1),
          }}
        >
          {sym}
        </span>
      ))}
      {/* Label below */}
      <div className="absolute -bottom-3.5 left-0 right-0 text-center text-terminal-dim text-[8px] font-mono truncate">
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
        :global(.cluster-targeted) {
          animation: cluster-shake 0.6s ease-in-out 2;
        }
        :global(.attack-target-ring) {
          animation: ring-pulse 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-terminal-border h-full p-2.5 flex flex-col">
      <div className="text-terminal-dim text-[10px] tracking-widest mb-2">{label}</div>
      <div className="flex-1 overflow-hidden relative">{children}</div>
    </div>
  );
}
