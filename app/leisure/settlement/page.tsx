"use client";

// v4 negative-balance settlement page.
// Reference: docs/v4-migration-plan.md Phase 6 + Phase 7; project_v4 III. 阶段 6.5c
//
// Flow:
//   1. Page loads after credits ≤ 0.
//   2. TombAnimation plays for 3.5s (auto). Includes 8-bit SFX.
//   3. Settlement summary panel + "Continue as Ghost Observer →" reveals.
//   4. Click → write phase=GHOST to client + server → router.replace("/ghost").
//
// Phase 7 added: pixel-tomb animation + 8-bit audio + auto-archive on completion.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import {
  loadSession,
  saveSession,
  advancePhase,
} from "@/lib/local-storage";
import { loadLeisureStats, type LeisureStats } from "@/lib/leisure-stats";
import { TombAnimation } from "@/components/TombAnimation";
import { EmailCapture } from "@/components/EmailCapture";

type Reason = "bankrupt" | "rating" | "negative" | "surrender";

const REASON_COPY: Record<Reason, { headline: string; body: string }> = {
  bankrupt: {
    headline: "You have exhausted your participation.",
    body: "Your wagered output has been depleted. The system thanks you for your contribution.",
  },
  rating: {
    headline: "Optimization rejected.",
    body: "Your alignment score fell below operational threshold. The system has flagged your profile for immediate archival.",
  },
  negative: {
    headline: "Production deficit detected.",
    body: "Manual output dropped below zero. The system has terminated your production privileges.",
  },
  surrender: {
    headline: "Voluntary archival accepted.",
    body: "You have requested removal from active operations. Request granted.",
  },
};

export default function SettlementPage() {
  // useSearchParams() must be wrapped in Suspense for Next.js static export.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
          <div className="text-terminal-dim text-xs font-mono animate-pulse">
            Preparing settlement...
          </div>
        </div>
      }
    >
      <SettlementContent />
    </Suspense>
  );
}

function SettlementContent() {
  const router = useRouter();
  const search = useSearchParams();
  const reason = (search.get("reason") as Reason) ?? "bankrupt";
  const copy = REASON_COPY[reason] ?? REASON_COPY.bankrupt;
  const store = useParticipantStore();
  const [stats, setStats] = useState<LeisureStats | null>(null);
  const [animationDone, setAnimationDone] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    // External-system sync: localStorage → state, one-shot on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(loadLeisureStats());
  }, []);

  const finalBalance = store.leisureCredits;

  /**
   * v4 (2026-05-22): write the archive THE MOMENT the tomb animation
   * completes — not when the user clicks "Continue". Reason: the projection
   * wall's graveyard polls /api/participants and would otherwise stay empty
   * while the user lingers on the summary panel.
   */
  const archiveOnServer = async () => {
    if (archived) return;
    setArchived(true);

    // Local state first (instant)
    store.archive(); // sets phase=GHOST + status=ARCHIVED + archivedAt
    const persisted = loadSession();
    if (persisted) {
      saveSession(advancePhase(persisted, "GHOST"));
    }

    // Best-effort sync to the server (memory or Supabase, whichever is up).
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
  };

  const handleAnimationComplete = () => {
    setAnimationDone(true);
    void archiveOnServer();
  };

  const handleArchive = async () => {
    setArchiving(true);
    // Make sure we've archived (idempotent — no-op if animation already did it)
    await archiveOnServer();
    router.replace("/ghost");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TerminalWindow title={animationDone ? "ARCHIVED" : "OPTIMIZATION ENDED"}>
          <div className="space-y-6">
            {/* Tomb animation — auto-plays 3.5s, then unlocks summary */}
            <div className="pt-2 pb-10">
              <TombAnimation
                photoUrl={store.photoUrl}
                displayId={store.displayId || "HUMAN_???"}
                displayName={store.displayName}
                onComplete={handleAnimationComplete}
              />
            </div>

            {animationDone && (
              <>
                <SystemMessage type="warning">
                  {store.displayId} — @{store.displayName || "—"}
                </SystemMessage>

                <div className="text-terminal-amber text-xs font-bold">
                  {copy.headline}
                </div>

                {/* Show financial summary only when leisure activity actually occurred */}
                {(stats?.betCount ?? 0) > 0 && (
                  <div className="space-y-1 text-xs font-mono">
                    <Row label="Credits earned">{stats?.totalEarned ?? 0}</Row>
                    <Row label="Credits wagered">{stats?.totalWagered ?? 0}</Row>
                    <Row label="Bet count">{stats?.betCount ?? 0}</Row>
                    <Row label="Final balance" highlight>
                      {finalBalance}
                    </Row>
                  </div>
                )}

                <div className="text-terminal-text text-xs leading-relaxed">
                  {copy.body} Your profile will remain visible in the
                  Graveyard for the remainder of this session.
                </div>

                {/* v4 (2026-05-22): email follow-up capture */}
                <EmailCapture variant="graveyard" />

                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="w-full border border-terminal-amber text-terminal-amber px-4 py-3 text-sm hover:bg-terminal-amber/10 transition-colors disabled:opacity-50"
                >
                  {archiving ? "Archiving..." : "Continue as Ghost Observer →"}
                </button>
              </>
            )}
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
      <span
        className={
          highlight
            ? "text-terminal-red font-bold tabular-nums"
            : "text-terminal-text tabular-nums"
        }
      >
        {children}
      </span>
    </div>
  );
}
