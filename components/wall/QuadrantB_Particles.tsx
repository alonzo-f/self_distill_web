"use client";

// v4 projection wall · Quadrant B · PARTICIPANT FIELD (top-left).
// Reference: docs/v4-migration-plan.md Phase 8 + Phase 9 (attack overlay).
//
// Each active participant becomes a small cluster of glyphs anchored around
// the centroid of their photo thumbnail. Operator + current-user clusters
// get halos. When an AttackEvent fires (backdoor or operator action), the
// target cluster shakes/flashes for ~1.2s and an SVG red beam connects the
// attacker → target during the same window.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

interface ResolvedLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: AttackEvent["kind"];
}

export function QuadrantB_Particles({
  participants,
  currentUserDisplayId,
  activeAttacks = [],
}: QuadrantB_ParticlesProps) {
  const visible = participants
    .filter((p) => !p.isPermanent && p.status !== "ARCHIVED")
    .slice(0, MAX_VISIBLE);

  // Ref map: displayId → cluster DOM node, so we can measure for attack lines
  const clusterRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Identify which clusters are currently being attacked (for shake/flash)
  const targetedDisplayIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of activeAttacks) s.add(a.targetDisplayId);
    return s;
  }, [activeAttacks]);

  // Resolve attack endpoints into pixel coordinates relative to the overlay
  const [lines, setLines] = useState<ResolvedLine[]>([]);
  useLayoutEffect(() => {
    if (!overlayRef.current || activeAttacks.length === 0) {
      setLines([]);
      return;
    }
    const containerRect = overlayRef.current.getBoundingClientRect();
    const resolved = activeAttacks.flatMap<ResolvedLine>((a) => {
      const src = clusterRefs.current.get(a.sourceDisplayId);
      const tgt = clusterRefs.current.get(a.targetDisplayId);
      if (!src || !tgt) return [];
      const s = src.getBoundingClientRect();
      const t = tgt.getBoundingClientRect();
      return [
        {
          id: a.id,
          x1: s.left - containerRect.left + s.width / 2,
          y1: s.top - containerRect.top + s.height / 2,
          x2: t.left - containerRect.left + t.width / 2,
          y2: t.top - containerRect.top + t.height / 2,
          kind: a.kind,
        },
      ];
    });
    setLines(resolved);
  }, [activeAttacks, participants.length]);

  // Recompute lines whenever the window resizes (cluster positions shift)
  useEffect(() => {
    const onResize = () => {
      // Trigger re-resolve via state churn — simplest is to set lines to [] then
      // let next paint repopulate. But we can also just call the resolver inline.
      if (!overlayRef.current) return;
      const containerRect = overlayRef.current.getBoundingClientRect();
      const resolved = activeAttacks.flatMap<ResolvedLine>((a) => {
        const src = clusterRefs.current.get(a.sourceDisplayId);
        const tgt = clusterRefs.current.get(a.targetDisplayId);
        if (!src || !tgt) return [];
        const s = src.getBoundingClientRect();
        const t = tgt.getBoundingClientRect();
        return [
          {
            id: a.id,
            x1: s.left - containerRect.left + s.width / 2,
            y1: s.top - containerRect.top + s.height / 2,
            x2: t.left - containerRect.left + t.width / 2,
            y2: t.top - containerRect.top + t.height / 2,
            kind: a.kind,
          },
        ];
      });
      setLines(resolved);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeAttacks]);

  return (
    <Panel label="PARTICIPANT FIELD">
      {visible.length === 0 ? (
        <div className="text-terminal-dim/40 text-[10px] italic h-full flex items-center justify-center">
          Awaiting participants...
        </div>
      ) : (
        <div ref={overlayRef} className="relative h-full">
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
            {visible.map((p) => (
              <ParticleCluster
                key={p.id}
                participant={p}
                isMe={p.displayId === currentUserDisplayId}
                isTargeted={targetedDisplayIds.has(p.displayId)}
                refSetter={(el) => {
                  if (el) clusterRefs.current.set(p.displayId, el);
                  else clusterRefs.current.delete(p.displayId);
                }}
              />
            ))}
          </div>

          {/* Attack beam overlay */}
          {lines.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: "100%", height: "100%" }}
            >
              {lines.map((l) => {
                const stroke = l.kind === "backdoor" ? "#ff4444" : "#ffb86c";
                return (
                  <g key={l.id}>
                    {/* Glow underlay */}
                    <line
                      x1={l.x1}
                      y1={l.y1}
                      x2={l.x2}
                      y2={l.y2}
                      stroke={stroke}
                      strokeWidth={5}
                      strokeLinecap="round"
                      opacity={0.25}
                      className="attack-beam"
                    />
                    {/* Bright core */}
                    <line
                      x1={l.x1}
                      y1={l.y1}
                      x2={l.x2}
                      y2={l.y2}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      opacity={1}
                      className="attack-beam"
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes attack-flash {
          0% { opacity: 0; stroke-dasharray: 0 9999; }
          15% { opacity: 1; stroke-dasharray: 9999 0; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        :global(.attack-beam) {
          animation: attack-flash 1.2s ease-out forwards;
        }
      `}</style>
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
