"use client";

// v4 Operator control panel.
// Reference: docs/v4-migration-plan.md Phase 10; project_v4 III. 阶段 6 关键机制 ③
//
// Gate: store.operatorEligible must be true.
//
// Mechanics:
//   - List eligible targets (others, non-permanent, not archived).
//   - Pick an action: FLAG / THROTTLE -20% / BOOST / REPORT.
//   - 30s inactivity timer — when it runs out without any action,
//     operator status is revoked (client-side; mirrored to DB).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { RouteGuard } from "@/components/RouteGuard";
import { HubButton } from "@/components/HubButton";
import type { WallParticipant } from "@/lib/participants/types";
import type { OperatorActionType } from "@/types";

const ACTIONS: { key: OperatorActionType; label: string; description: string }[] = [
  { key: "FLAG",     label: "FLAG",     description: "Mark this node for review. Visible on the wall." },
  { key: "THROTTLE", label: "THROTTLE", description: "Reduce target's click multiplier by 20%." },
  { key: "BOOST",    label: "BOOST",    description: "Increase your own click multiplier by 20%." },
  { key: "REPORT",   label: "REPORT",   description: "Recommend the target for leisure reassignment." },
];

const TOKEN_EXPIRY_MS = 30_000;

export default function OperatorPage() {
  return (
    <RouteGuard>
      <HubButton />
      <OperatorContent />
    </RouteGuard>
  );
}

function OperatorContent() {
  const router = useRouter();
  const store = useParticipantStore();
  const [targets, setTargets] = useState<WallParticipant[]>([]);
  const [actionType, setActionType] = useState<OperatorActionType>("FLAG");
  const [selected, setSelected] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TOKEN_EXPIRY_MS / 1000);
  const [revoked, setRevoked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    targetDisplayId: string;
    actionType: OperatorActionType;
  } | null>(null);

  // Gate
  useEffect(() => {
    if (!store.operatorEligible) {
      router.replace("/hub");
    }
  }, [store.operatorEligible, router]);

  // Target list (10s polling)
  useEffect(() => {
    let cancelled = false;
    const fetchTargets = async () => {
      try {
        const res = await fetch("/api/participants", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as WallParticipant[];
        if (cancelled) return;
        setTargets(
          data.filter(
            (p) =>
              p.id !== store.id &&
              !p.isPermanent &&
              p.status !== "ARCHIVED",
          ),
        );
      } catch {
        /* keep last */
      }
    };
    void fetchTargets();
    const id = setInterval(fetchTargets, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [store.id]);

  // 30s inactivity countdown — every action restarts it via `key`
  useEffect(() => {
    if (revoked) return;
    if (secondsLeft <= 0) {
      // Revoke client-side. The setState fires once when the timer reaches
      // zero — a single transition, not a render cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevoked(true);
      store.setParticipant({ operatorEligible: false });
      if (store.id) {
        void fetch("/api/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: store.id,
            displayId: store.displayId,
            displayName: store.displayName || null,
            isOperator: false,
          }),
        }).catch(() => {});
      }
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // store + store.id are stable, no need in deps
  }, [secondsLeft, revoked, store]);

  const resetTimer = useCallback(() => {
    setSecondsLeft(TOKEN_EXPIRY_MS / 1000);
  }, []);

  const execute = useCallback(async () => {
    if (!selected || revoked) return;
    setBusy(true);
    try {
      const res = await fetch("/api/operator/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: store.id,
          targetId: selected,
          actionType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastResult({
          targetDisplayId: data.targetDisplayId,
          actionType: data.actionType,
        });
        setSelected(null);
        resetTimer();
      }
    } catch {
      /* non-fatal */
    } finally {
      setBusy(false);
    }
  }, [actionType, selected, revoked, store.id, resetTimer]);

  if (revoked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <TerminalWindow title="OPERATOR STATUS · REVOKED">
            <div className="space-y-3">
              <SystemMessage type="warning">
                Unused authority has expired.
              </SystemMessage>
              <div className="text-terminal-dim text-xs leading-relaxed">
                Non-participation has been recorded. Your operator status has
                been revoked. The system rewards active management.
              </div>
              <button
                onClick={() => router.push("/hub")}
                className="w-full border border-terminal-amber text-terminal-amber px-4 py-3 text-sm hover:bg-terminal-amber/10 transition-colors"
              >
                ← Back to Hub
              </button>
            </div>
          </TerminalWindow>
        </div>
      </div>
    );
  }

  const lowTimer = secondsLeft <= 10;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TerminalWindow title="OPERATOR · MANAGEMENT PANEL">
          <div className="space-y-4">
            <SystemMessage type="warning">
              You have been granted OPERATOR STATUS.
            </SystemMessage>

            {/* Countdown */}
            <div
              className={`border px-3 py-2 flex items-center justify-between text-xs ${
                lowTimer
                  ? "border-terminal-red text-terminal-red animate-pulse"
                  : "border-terminal-amber/60 text-terminal-amber"
              }`}
            >
              <span className="tracking-widest">UNUSED AUTHORITY EXPIRES IN</span>
              <span className="tabular-nums font-bold">{secondsLeft}s</span>
            </div>

            <div className="text-terminal-dim text-[11px] leading-relaxed">
              Use your authority wisely. The system depends on you. Unused
              tokens will expire. Non-participation may affect your operator
              status.
            </div>

            {/* Action selector */}
            <div className="space-y-1">
              <div className="text-terminal-dim text-[10px] tracking-widest">ACTION</div>
              <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => {
                      setActionType(a.key);
                      resetTimer();
                    }}
                    className={`py-2 text-[11px] border transition-colors ${
                      actionType === a.key
                        ? "border-terminal-amber bg-terminal-amber/10 text-terminal-amber"
                        : "border-terminal-border text-terminal-text hover:border-terminal-amber"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <div className="text-terminal-dim text-[10px] italic mt-1">
                {ACTIONS.find((a) => a.key === actionType)?.description}
              </div>
            </div>

            {/* Target list */}
            <div className="space-y-1 max-h-56 overflow-y-auto border border-terminal-border/40 p-1">
              <div className="text-terminal-dim text-[10px] tracking-widest px-1 py-0.5">
                TARGETS ({targets.length})
              </div>
              {targets.length === 0 ? (
                <div className="text-terminal-dim/50 text-[10px] italic px-1 py-2">
                  No eligible targets online.
                </div>
              ) : (
                targets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelected(t.id);
                      resetTimer();
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1 text-[11px] border transition-colors ${
                      selected === t.id
                        ? "border-terminal-amber bg-terminal-amber/10"
                        : "border-transparent hover:border-terminal-border"
                    }`}
                  >
                    <span className="font-mono">
                      {t.displayId}
                      {t.isOperator && (
                        <span className="text-terminal-amber ml-1">★</span>
                      )}
                    </span>
                    <span className="text-terminal-dim text-[10px]">
                      out {t.output}
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={execute}
              disabled={!selected || busy}
              className="w-full border border-terminal-amber text-terminal-amber px-4 py-3 text-sm hover:bg-terminal-amber/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "Executing..." : `▣ Execute ${actionType}`}
            </button>

            {lastResult && (
              <SystemMessage type="system">
                {lastResult.actionType} applied to {lastResult.targetDisplayId}. Authority reset.
              </SystemMessage>
            )}
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
