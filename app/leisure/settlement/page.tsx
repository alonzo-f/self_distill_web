"use client";

// v4 negative-balance settlement page.
// Reference: docs/v4-migration-plan.md Phase 6, Phase 7; project_v4 III. 阶段 6.5c
//
// Reached when the user's leisureCredits hits 0 or negative. Phase 6 ships
// a functional settlement screen that:
//   - shows the run summary (earned / wagered / final balance)
//   - flips phase=GHOST locally and on the server
//   - routes to /ghost
//
// Phase 7 will replace this with the pixel-tomb animation + 8-bit audio.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import {
  loadSession,
  saveSession,
  advancePhase,
} from "@/lib/local-storage";
import { loadLeisureStats, type LeisureStats } from "@/lib/leisure-stats";

export default function SettlementPage() {
  const router = useRouter();
  const store = useParticipantStore();
  const [stats, setStats] = useState<LeisureStats | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    // External-system sync: localStorage → state, one-shot on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(loadLeisureStats());
  }, []);

  const finalBalance = store.leisureCredits;

  const handleArchive = async () => {
    setArchiving(true);
    // Persist GHOST phase on the client
    store.archive(); // sets phase=GHOST + status=ARCHIVED + archivedAt
    const persisted = loadSession();
    if (persisted) {
      saveSession(advancePhase(persisted, "GHOST"));
    }
    // Best-effort sync the archival to the server
    if (store.id) {
      try {
        await fetch("/api/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: store.id,
            displayId: store.displayId,
            displayName: store.displayName || null,
            status: "ARCHIVED",
            phase: "GHOST",
            archivedAt: Date.now(),
          }),
        });
      } catch {
        /* non-fatal */
      }
    }
    router.replace("/ghost");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TerminalWindow title="ARCHIVED">
          <div className="space-y-4">
            <div className="text-center text-terminal-red text-2xl font-bold tracking-widest">
              SETTLEMENT
            </div>
            <SystemMessage type="warning">
              {store.displayId} — @{store.displayName || "—"}
            </SystemMessage>

            {/* Phase 7 placeholder — full pixel-tomb animation will live here */}
            <div className="rounded-md border border-dashed border-terminal-dim/40 p-6 text-center text-terminal-dim/70 text-[11px] italic">
              [pixel-tomb animation — coming in Phase 7]
            </div>

            <div className="space-y-1 text-xs font-mono">
              <Row label="Credits earned">{stats?.totalEarned ?? 0}</Row>
              <Row label="Credits wagered">{stats?.totalWagered ?? 0}</Row>
              <Row label="Bet count">{stats?.betCount ?? 0}</Row>
              <Row label="Final balance" highlight>
                {finalBalance}
              </Row>
            </div>

            <div className="text-terminal-text text-xs leading-relaxed">
              You have exhausted your participation. The system thanks you for
              your contribution. Your profile will remain visible in the
              Graveyard for the remainder of this session.
            </div>

            <button
              onClick={handleArchive}
              disabled={archiving}
              className="w-full border border-terminal-amber text-terminal-amber px-4 py-3 text-sm hover:bg-terminal-amber/10 transition-colors disabled:opacity-50"
            >
              {archiving ? "Archiving..." : "Continue as Ghost Observer →"}
            </button>
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between border-b border-terminal-border/50 pb-1">
      <span className="text-terminal-dim text-[10px] tracking-widest">{label}</span>
      <span className={highlight ? "text-terminal-red font-bold tabular-nums" : "text-terminal-text tabular-nums"}>
        {children}
      </span>
    </div>
  );
}
