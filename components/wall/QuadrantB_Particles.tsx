"use client";

// v4 projection wall · Quadrant B · PARTICIPANT FIELD (top-left).
// Reference: docs/v4-migration-plan.md Phase 8; project_v4 IV.
//
// Each active participant becomes a small cluster of glyphs anchored
// around the centroid of their photo thumbnail. v4 spec calls for full
// Three.js particle clouds; for Phase 8 we ship a CSS-only approximation
// that still expresses the "field of people" gestalt and leaves room for
// Phase 9 to attach attack-line overlays.

import { useMemo } from "react";
import type { WallParticipant } from "@/lib/participants/types";

interface QuadrantB_ParticlesProps {
  participants: WallParticipant[];
  currentUserDisplayId?: string;
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
}: QuadrantB_ParticlesProps) {
  const visible = participants
    .filter((p) => !p.isPermanent && p.status !== "ARCHIVED")
    .slice(0, MAX_VISIBLE);

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
}: {
  participant: WallParticipant;
  isMe: boolean;
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
    <div className="relative aspect-square flex items-center justify-center">
      {/* Halo for operators / current user */}
      {showHalo && (
        <div
          className={`absolute inset-1 rounded-full border ${
            isMe ? "border-terminal-green/70" : "border-amber-300/70"
          } animate-pulse`}
        />
      )}
      {/* Photo nucleus */}
      <div className="relative z-10 w-7 h-7 border border-terminal-dim/40 overflow-hidden">
        {participant.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={participant.photoUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
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
    </div>
  );
}

function hashSeed(s: string): number {
  // FNV-1a style hash, sufficient for stable per-id deterministic angles.
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
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
