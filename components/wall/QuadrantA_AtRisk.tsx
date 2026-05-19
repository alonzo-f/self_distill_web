"use client";

// v4 projection wall · Quadrant A · AT-RISK QUEUE (top-right).
// Reference: docs/v4-migration-plan.md Phase 8; project_v4 IV.
//
// Worst-first ranking by emotional_noise (higher = closer to elimination).
// Top 5 stay pinned; positions 6+ scroll horizontally as a ticker (Bloomberg
// terminal / airport flight board feel).

import { useEffect, useState } from "react";
import type { WallParticipant } from "@/lib/participants/types";

interface QuadrantA_AtRiskProps {
  participants: WallParticipant[];
}

const PINNED = 5;
const SCROLL_TICK_MS = 100;
const TICKER_STEP_PX = 1; // pixels per tick — adjust to control speed

export function QuadrantA_AtRisk({ participants }: QuadrantA_AtRiskProps) {
  // Worst-first: highest emotional_noise, then lowest output as tiebreaker.
  // Exclude already-archived rows.
  const ranked = participants
    .filter((p) => p.status !== "ARCHIVED" && !p.isPermanent)
    .sort((a, b) => {
      const an = a.scores?.emotional_noise_score ?? 0;
      const bn = b.scores?.emotional_noise_score ?? 0;
      if (an !== bn) return bn - an;
      return (a.output ?? 0) - (b.output ?? 0);
    });

  const pinned = ranked.slice(0, PINNED);
  const ticker = ranked.slice(PINNED);

  return (
    <Panel label="AT-RISK QUEUE">
      {pinned.length === 0 ? (
        <div className="text-terminal-dim/40 text-[10px] italic">
          No participants yet.
        </div>
      ) : (
        <div className="space-y-1">
          {pinned.map((p, i) => (
            <RankedRow key={p.id} rank={i + 1} participant={p} />
          ))}
        </div>
      )}
      {ticker.length > 0 && <Ticker entries={ticker} />}
    </Panel>
  );
}

function RankedRow({ rank, participant }: { rank: number; participant: WallParticipant }) {
  const noise = participant.scores?.emotional_noise_score ?? 0;
  const isTop = rank === 1;
  return (
    <div
      className={`flex items-center gap-2 border px-2 py-1 ${
        isTop
          ? "border-terminal-red/60 bg-terminal-red/5"
          : "border-terminal-border/40"
      }`}
    >
      <span
        className={`text-[10px] font-bold tabular-nums w-5 ${
          isTop ? "text-terminal-red" : "text-terminal-dim"
        }`}
      >
        #{rank}
      </span>
      {participant.photoUrl ? (
        // Don't use next/image here — performance budget on /wall favors raw img.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={participant.photoUrl}
          alt=""
          className="w-7 h-7 object-cover border border-terminal-dim/30"
          style={{ transform: "scaleX(-1)" }}
        />
      ) : (
        <div className="w-7 h-7 bg-terminal-dim/10 border border-terminal-dim/30" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-terminal-text text-[11px] font-mono truncate">
          {participant.displayId}
        </div>
        <div className="text-terminal-dim text-[9px]">
          noise: {noise} ↓
        </div>
      </div>
    </div>
  );
}

function Ticker({ entries }: { entries: WallParticipant[] }) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      // External-system sync: timer-driven motion → state. Periodic, no cascade.
      setOffset((o) => o + TICKER_STEP_PX);
    }, SCROLL_TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Duplicate the list to make the loop seamless
  const list = [...entries, ...entries];

  return (
    <div className="mt-2 border-t border-terminal-border/40 pt-1 overflow-hidden">
      <div
        className="flex gap-3 whitespace-nowrap"
        style={{
          transform: `translateX(-${offset}px)`,
          willChange: "transform",
        }}
      >
        {list.map((p, i) => (
          <span key={`${p.id}-${i}`} className="text-terminal-dim text-[10px] font-mono">
            #{i + PINNED + 1} {p.displayId} · noise{" "}
            {p.scores?.emotional_noise_score ?? "—"}
          </span>
        ))}
      </div>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-terminal-border h-full p-2.5 flex flex-col">
      <div className="text-terminal-dim text-[10px] tracking-widest mb-2">{label}</div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
