"use client";

// v4 projection wall · Quadrant D · GRAVEYARD (bottom-left).
// Reference: docs/v4-migration-plan.md Phase 8; project_v4 IV.
//
// Polls /api/graveyard every 30s (NOT realtime — periodic statistic feel).
// Shows nicknames only (灰色, 真实昵称) and pushes BUILDER_01 / BUILDER_02
// to a permanent gold-highlighted footer.

import { useEffect, useState } from "react";
import type { GraveyardEntry } from "@/lib/participants/types";

const POLL_INTERVAL_MS = 30_000;
const MAX_VISIBLE = 12;

export function QuadrantD_Graveyard() {
  const [entries, setEntries] = useState<GraveyardEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/graveyard", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { entries: GraveyardEntry[] };
        if (!cancelled) setEntries(data.entries);
      } catch {
        /* keep last-known state */
      }
    };
    void fetchOnce();
    const id = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const archived = entries.filter((e) => !e.isPermanent).slice(0, MAX_VISIBLE);
  const builders = entries.filter((e) => e.isPermanent);
  const overflow = entries.filter((e) => !e.isPermanent).length - archived.length;

  return (
    <Panel label="GRAVEYARD">
      <div className="space-y-0.5 overflow-hidden">
        {archived.length === 0 ? (
          <div className="text-terminal-dim/40 text-[10px] italic">
            No archives yet.
          </div>
        ) : (
          archived.map((e, i) => (
            <Row key={`a-${i}-${e.displayName}`}>
              <span className="text-terminal-dim/70 truncate">
                @{e.displayName}
              </span>
              <span className="text-terminal-dim/40 text-[9px] tabular-nums">
                {formatTime(e.archivedAt)}
              </span>
            </Row>
          ))
        )}
        {overflow > 0 && (
          <div className="text-terminal-dim/40 text-[9px] italic pt-0.5">
            [+{overflow} more]
          </div>
        )}

        {/* Permanent Builder anchors — always at the bottom in gold */}
        {builders.length > 0 && (
          <>
            <div className="border-t border-terminal-border/40 my-1.5" />
            {builders.map((b, i) => (
              <Row key={`b-${i}`}>
                <span className="text-amber-300/90 font-bold tracking-widest">
                  {b.displayName}
                </span>
                <span className="text-amber-300/60 text-[9px]">∞</span>
              </Row>
            ))}
          </>
        )}
      </div>
    </Panel>
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

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between font-mono text-[11px] gap-2 leading-tight">
      {children}
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}
