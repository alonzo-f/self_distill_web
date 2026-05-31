"use client";

// v4 backdoor attack interface.
// Reference: docs/v4-migration-plan.md Phase 9; project_v4 III. 阶段 6.8
//
// Lists current non-archived non-permanent participants. User picks one,
// chooses an action (SIPHON / CORRUPT / SWAP), and spends one token.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { RouteGuard } from "@/components/RouteGuard";
import { HubButton } from "@/components/HubButton";
import type { WallParticipant } from "@/lib/participants/types";
import type { BackdoorAttackType } from "@/types";
import { playAttackSfx, unlockAudio } from "@/lib/audio/eight-bit";

const ACTIONS: { key: BackdoorAttackType; label: string; description: string }[] = [
  { key: "SIPHON",  label: "SIPHON",  description: "Transfer 50 credits from target → you" },
  { key: "CORRUPT", label: "CORRUPT", description: "Force target's next 3 clicks to register as errors" },
  { key: "SWAP",    label: "SWAP",    description: "Exchange leaderboard output with target" },
];

export default function BackdoorAttackPage() {
  return (
    <RouteGuard>
      <HubButton />
      <AttackContent />
    </RouteGuard>
  );
}

function AttackContent() {
  const router = useRouter();
  const store = useParticipantStore();
  const [targets, setTargets] = useState<WallParticipant[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [actionType, setActionType] = useState<BackdoorAttackType>("SIPHON");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    targetDisplayId: string;
    actionType: BackdoorAttackType;
    remainingTokens: number;
  } | null>(null);

  // Gate
  useEffect(() => {
    if (store.phase !== "BACKDOOR_FOUND" && !store.backendUnlocked) {
      router.replace("/hub");
    }
  }, [store.phase, store.backendUnlocked, router]);

  // Load potential targets
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

  const executeAttack = async () => {
    if (!selected) return;
    if (store.attackTokens <= 0) return;
    setBusy(true);
    // v4 (2026-05-22): audio cue for the attack — fires immediately on
    // click so the SFX lines up with the button press, not the network
    // round-trip.
    void unlockAudio();
    playAttackSfx();
    try {
      const res = await fetch("/api/backdoor/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attackerId: store.id,
          targetId: selected,
          actionType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Decrement client-side token mirror
        store.spendAttackToken();
        setLastResult({
          targetDisplayId: data.targetDisplayId,
          actionType: data.actionType,
          remainingTokens: data.remainingTokens,
        });
        setSelected(null);

        // v4 (2026-05-22, 修改0519.md item 6+7): hand off the attack details
        // to the /wall page via sessionStorage so it can replay the kill
        // animation immediately on mount — without waiting for Supabase
        // realtime or the next 5s poll. Includes the attacker's display
        // id so the live announcement reads "X killed Y".
        try {
          sessionStorage.setItem(
            "self-distill:pending-attack",
            JSON.stringify({
              targetDisplayId: data.targetDisplayId,
              attackerDisplayId: data.attackerDisplayId ?? store.displayId,
              actionType: data.actionType,
              amount: data.amount ?? null,
              at: Date.now(),
            }),
          );
        } catch {
          /* sessionStorage unavailable — non-fatal, wall just won't auto-replay */
        }

        // Jump to the wall so they see the kill animation on the big screen.
        window.setTimeout(() => router.push("/wall"), 1200);
      }
    } catch {
      /* non-fatal */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TerminalWindow title="BACKDOOR · ATTACK INTERFACE">
          <div className="space-y-4">
            <SystemMessage type="warning">
              Tokens remaining: {store.attackTokens}
            </SystemMessage>

            {store.attackTokens === 0 ? (
              <>
                <div className="text-terminal-text text-xs leading-relaxed">
                  You have spent all of your disruption tokens. The system
                  thanks you for your active management.
                </div>
                <button
                  onClick={() => router.push("/hub")}
                  className="w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
                >
                  ← Back to Hub
                </button>
              </>
            ) : (
              <>
                <div className="text-terminal-dim text-[11px] leading-relaxed">
                  Pick a target and an action. Each attack costs 1 token.
                  Tokens expire when you leave this session.
                </div>

                {/* Action selector */}
                <div className="space-y-1">
                  <div className="text-terminal-dim text-[10px] tracking-widest">ACTION</div>
                  <div className="grid grid-cols-3 gap-2">
                    {ACTIONS.map((a) => (
                      <button
                        key={a.key}
                        onClick={() => setActionType(a.key)}
                        className={`py-2 text-[11px] border transition-colors ${
                          actionType === a.key
                            ? "border-terminal-red bg-terminal-red/10 text-terminal-red"
                            : "border-terminal-border text-terminal-text hover:border-terminal-red"
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
                        onClick={() => setSelected(t.id)}
                        className={`w-full flex items-center justify-between px-2 py-1 text-[11px] border transition-colors ${
                          selected === t.id
                            ? "border-terminal-red bg-terminal-red/10"
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
                  onClick={executeAttack}
                  disabled={!selected || busy}
                  className="w-full border border-terminal-red text-terminal-red px-4 py-3 text-sm hover:bg-terminal-red/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  // v4 (2026-05-22): plays its own attack SFX — suppress
                  // the generic click tick so the kick lands clean.
                  data-no-sfx
                >
                  {busy ? "Executing..." : `⚔ Execute ${actionType}`}
                </button>

                {lastResult && (
                  <SystemMessage type="system">
                    {lastResult.actionType} on {lastResult.targetDisplayId} · {lastResult.remainingTokens} tokens left
                  </SystemMessage>
                )}
              </>
            )}
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
