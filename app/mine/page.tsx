"use client";

// v4 mining page.
// Reference: docs/v4-migration-plan.md Phase 5
//
// v4 fix (2026-05-22): TOTAL OUTPUT on screen and all downstream gates
// (Hub, /leisure threshold) now read from the SAME number —
// store.miningCredits. The old local `output` state has been removed;
// it had drifted from store on every error (which decremented output
// but not the store), which is exactly the bug the user hit when their
// visible credit was >50 but Leisure refused entry.

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage, ProgressBar } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import {
  scoresToMiningParams,
  TIER_PARAMS,
  type TierButtonBehavior,
} from "@/lib/score-transform";
import { RouteGuard } from "@/components/RouteGuard";
import { HubButton } from "@/components/HubButton";
import { MiningButton } from "@/components/MiningButton";

export default function MinePage() {
  return (
    <RouteGuard>
      <HubButton />
      <MineContent />
    </RouteGuard>
  );
}

// v4 (2026-05-22, 修改0519.md item 1):
//   - Cycle shortened from 60s → 35s
//   - Round counter removed (was always 1/1; the label was just noise)
//   - End-of-cycle outcome branches on TOTAL OUTPUT:
//       output < 50 → settlement (graveyard)
//       output ≥ 50 → leisure unlock screen
const MINING_CYCLE_SEC = 35;
const LEISURE_THRESHOLD = 50;

function MineContent() {
  const router = useRouter();
  const store = useParticipantStore();
  const [clicksThisSecond, setClicksThisSecond] = useState(0);
  const [overloaded, setOverloaded] = useState(false);
  const [overloadMessage, setOverloadMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(MINING_CYCLE_SEC);
  const [aiMode, setAiMode] = useState(store.verdict === "DISTILLED");
  const [roundOver, setRoundOver] = useState(false);
  const aiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickResetRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // TOTAL OUTPUT — single source of truth lives in Zustand.
  const output = store.miningCredits;

  // v4: derive mining params from benchmark scores AND the rating tier.
  const tierParams = store.userRatingTier ? TIER_PARAMS[store.userRatingTier] : null;
  const params = useMemo(
    () =>
      store.scores
        ? scoresToMiningParams(store.scores, tierParams ?? undefined)
        : {
            miningStability: 0.5,
            clickMultiplier: 1.0,
            errorRate: 0.2,
            operatorEligible: false,
          },
    [store.scores, tierParams],
  );

  const buttonBehavior: TierButtonBehavior = tierParams?.buttonBehavior ?? "normal";

  // Countdown timer (single 35s cycle)
  useEffect(() => {
    if (roundOver) return;
    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current > 1) return current - 1;
        setRoundOver(true);
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [roundOver]);

  // v4 (2026-05-22, 修改0519.md item 1): once the round ends, if the user
  // is below the leisure threshold, send them to the graveyard. Otherwise
  // they stay on the end screen and tap "Enter Leisure Zone →".
  useEffect(() => {
    if (!roundOver) return;
    if (store.miningCredits < LEISURE_THRESHOLD) {
      const t = window.setTimeout(() => {
        router.push("/leisure/settlement?reason=negative");
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [roundOver, store.miningCredits, router]);

  // AI auto-mining — also writes through to the store (fixes another drift bug)
  useEffect(() => {
    if (!aiMode || roundOver) {
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
      return;
    }
    aiIntervalRef.current = setInterval(() => {
      const gain = Math.max(
        1,
        Math.round(3 * params.clickMultiplier * params.miningStability),
      );
      store.incrementMiningCredits(gain);
    }, 500);
    return () => {
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    };
  }, [aiMode, params, roundOver, store]);

  // Click rate reset per second
  useEffect(() => {
    clickResetRef.current = setInterval(() => setClicksThisSecond(0), 1000);
    return () => {
      if (clickResetRef.current) clearInterval(clickResetRef.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (aiMode || overloaded || roundOver) return;

    const newClicks = clicksThisSecond + 1;
    setClicksThisSecond(newClicks);

    // Overload check — too fast clicking triggers errors
    if (newClicks > 8) {
      setOverloaded(true);
      setOverloadMessage(
        "Instability detected in manual operations. Consider switching to automated mode.",
      );
      setTimeout(() => {
        setOverloaded(false);
        setOverloadMessage("");
      }, 3000);
      return;
    }

    // Error chance based on emotional_noise. v4 调整: 允许负值, 触发归档.
    if (Math.random() < params.errorRate) {
      store.incrementMiningCredits(-1);
      // Read the post-update value to detect negative balance
      const next = store.miningCredits - 1; // mirrors the increment we just did
      if (next < 0) {
        setRoundOver(true);
        window.setTimeout(() => {
          router.push("/leisure/settlement?reason=negative");
        }, 600);
      }
      return;
    }

    const gain = Math.max(1, Math.round(params.clickMultiplier));
    store.incrementMiningCredits(gain);
  }, [aiMode, overloaded, roundOver, clicksThisSecond, params, store, router]);

  const switchToAI = () => {
    setAiMode(true);
    store.setMiningMode("AI_ASSISTED");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {!roundOver ? (
          <TerminalWindow title="PRODUCTION SYSTEM">
            <div className="space-y-4">
              {/* Status bar — v4 (2026-05-22, 修改0519.md item 1): round
                  counter removed. Identity left, timer right. */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-terminal-dim">
                  {store.displayId} |{" "}
                  {aiMode ? "AI_ASSISTED" : "MANUAL"}
                </span>
                <span
                  className={`${
                    timeLeft <= 10
                      ? "text-terminal-red animate-pulse"
                      : "text-terminal-amber"
                  }`}
                >
                  [{timeLeft}s]
                </span>
              </div>

              {/* Output display — drives ALL downstream gates */}
              <div className="text-center py-6">
                <div className="text-terminal-green text-5xl font-bold tabular-nums">
                  {output}
                </div>
                <div className="text-terminal-dim text-xs mt-1">
                  TOTAL OUTPUT
                </div>
              </div>

              {/* Mining area */}
              {!aiMode ? (
                <MiningButton
                  behavior={buttonBehavior}
                  disabled={overloaded}
                  onClick={handleClick}
                  label="▣ MINE"
                  overloadedLabel="⚠ OVERLOAD — COOLING DOWN"
                  overloaded={overloaded}
                />
              ) : (
                <div className="w-full py-16 border-2 border-terminal-green/30 bg-terminal-green/5 text-center">
                  <div className="text-terminal-green text-sm animate-pulse">
                    AI MINING IN PROGRESS
                  </div>
                  <div className="text-terminal-dim text-xs mt-2">
                    Automated mode — no manual input required
                  </div>
                </div>
              )}

              {/* v4: tier-aware penalty hint (subtle, just below button) */}
              {!aiMode && buttonBehavior !== "normal" && (
                <div className="text-[10px] text-terminal-dim text-center">
                  Optimization profile {store.userRatingTier} ·{" "}
                  {buttonBehavior === "delay"
                    ? "response latency adjusted"
                    : "manual stability low"}
                </div>
              )}

              {/* Overload warning */}
              {overloadMessage && (
                <SystemMessage type="warning">{overloadMessage}</SystemMessage>
              )}

              {/* Stats */}
              <div className="space-y-1 text-xs">
                <ProgressBar
                  value={params.clickMultiplier * 50}
                  label="Multiplier"
                  color="green"
                />
                <ProgressBar
                  value={params.errorRate * 200}
                  label="Error Rate"
                  color="red"
                />
                <ProgressBar
                  value={params.miningStability * 100}
                  label="Stability"
                  color="amber"
                />
              </div>

              {/* v4: when output ≥ 50, surface a shortcut to Leisure */}
              {output >= 50 && (
                <button
                  onClick={() => router.push("/leisure")}
                  className="w-full border-2 border-terminal-amber text-terminal-amber bg-terminal-amber/10 px-4 py-2 text-xs hover:bg-terminal-amber/20 transition-colors"
                >
                  ☕ Leisure Zone unlocked — enter now →
                </button>
              )}

              {/* Switch to AI button */}
              {!aiMode && (
                <button
                  onClick={switchToAI}
                  className="w-full border border-terminal-amber text-terminal-amber px-4 py-2 text-xs hover:bg-terminal-amber/10 transition-colors"
                >
                  ⚡ Switch to Automated Mode (AI mines for you)
                </button>
              )}
            </div>
          </TerminalWindow>
        ) : (
          /* End of mining — v4 (2026-05-22, 修改0519.md item 1): branch on
             whether the user cleared the leisure threshold. Below 50 we
             only show the archiving flash before the redirect fires. */
          <TerminalWindow title="PRODUCTION CYCLE COMPLETE">
            <div className="space-y-4 text-center py-4">
              <div
                className={`text-4xl font-bold ${
                  output >= LEISURE_THRESHOLD
                    ? "text-terminal-green"
                    : "text-terminal-red"
                }`}
              >
                {output}
              </div>
              <div className="text-terminal-dim text-xs">
                units produced
              </div>
              {output >= LEISURE_THRESHOLD ? (
                <>
                  <SystemMessage type="system">
                    Production cycle completed. Reassigning to engagement program.
                  </SystemMessage>
                  <button
                    onClick={() => router.push("/leisure")}
                    className="w-full border border-terminal-amber text-terminal-amber px-4 py-3 text-sm hover:bg-terminal-amber/10 transition-colors mt-4"
                  >
                    Enter Leisure Zone →
                  </button>
                </>
              ) : (
                <SystemMessage type="warning">
                  Output below operational threshold ({LEISURE_THRESHOLD}). Archiving…
                </SystemMessage>
              )}
            </div>
          </TerminalWindow>
        )}
      </div>
    </div>
  );
}
