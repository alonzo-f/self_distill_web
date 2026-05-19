"use client";

// v4 benchmark page with five-tier rating game.
// Reference: docs/v4-migration-plan.md Phase 4; project_v4 III. 阶段 4a.1
//
// Flow:
//   rate_ai  -- user picks 1-10 → Submit
//      │
//      ├─ rating >= 8  →  commit tier, proceed to processing
//      └─ rating <= 7  →  warning_shown
//                            ├─ [Re-evaluate]      → back to rate_ai (retried=true)
//                            └─ [Confirm low rating] → commit tier, processing
//   processing → ai_rates_you → /verdict

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage, ScoreDisplay } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { useTypingTracker } from "@/stores/typing-tracker";
import { mockBenchmark } from "@/lib/ai/mock";
import type { BenchmarkScores, RatingTier } from "@/types";
import { RouteGuard } from "@/components/RouteGuard";
import { WarningModal } from "@/components/WarningModal";
import {
  loadSession,
  saveSession,
  advancePhase,
  setSnapshot,
} from "@/lib/local-storage";
import { getRatingTier, TIER_PARAMS } from "@/lib/score-transform";

type Phase = "rate_ai" | "warning_shown" | "processing" | "ai_rates_you";

export default function BenchmarkPage() {
  return (
    <RouteGuard>
      <BenchmarkContent />
    </RouteGuard>
  );
}

function BenchmarkContent() {
  const router = useRouter();
  const store = useParticipantStore();
  const tracker = useTypingTracker();
  const [phase, setPhase] = useState<Phase>("rate_ai");
  const [userRating, setUserRating] = useState(5);
  const [retried, setRetried] = useState(false);
  const [committedTier, setCommittedTier] = useState<RatingTier | null>(null);
  const [scores, setScores] = useState<BenchmarkScores | null>(null);

  /** Push the participant's final data to the server-side wall registry */
  const registerOnWall = useCallback(
    async (finalScores: BenchmarkScores, finalVerdict: string, tier: RatingTier) => {
      if (!store.displayId) return;
      const output = Math.round(
        ((finalScores.clarity + finalScores.efficiency) / 2) * 5,
      );
      const tierParams = TIER_PARAMS[tier];
      try {
        await fetch("/api/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: store.id || store.displayId,
            displayId: store.displayId,
            displayName: store.displayName || null,
            status: "MINING",
            verdict: finalVerdict,
            output,
            isOperator: finalScores.operator_eligible ?? false,
            scores: {
              clarity_score: finalScores.clarity,
              efficiency_score: finalScores.efficiency,
              emotional_noise_score: finalScores.emotional_noise,
              compliance_score: finalScores.compliance,
            },
            // v4: persist tier params alongside the verdict
            userRatingTier: tier,
            tierClickMultiplier: tierParams.clickMultiplier,
            tierErrorRateFactor: tierParams.errorRateFactor,
            phase: "BENCHMARKED",
          }),
        });
      } catch {
        // Non-critical — wall just won't show this participant
      }
    },
    [store.displayId, store.id, store.displayName],
  );

  const runBenchmark = useCallback(
    async (tier: RatingTier) => {
      setPhase("processing");
      const metrics = tracker.getMetrics();

      try {
        const res = await fetch("/api/benchmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: store.id,
            promptText: store.promptText ?? "expression task",
            userInput: store.originalText || "",
            inputDurationSec: metrics.totalDurationSec,
            pauseCount: metrics.pauseCount,
            deletionCount: metrics.deletionCount,
            wordCount: metrics.wordCount,
            calibrationResults: store.calibrationAnswers.map((a) => ({
              questionKey: a.questionKey,
              selectedOption: a.selectedOption,
              responseTimeMs: a.responseTimeMs,
              changedAnswer: a.changedAnswer,
            })),
          }),
        });

        if (res.ok) {
          const data: BenchmarkScores = await res.json();
          // v4: apply the tier's compliance delta to the AI's compliance score.
          const tuned: BenchmarkScores = {
            ...data,
            compliance: clamp(data.compliance + TIER_PARAMS[tier].complianceDelta, 0, 100),
          };
          setScores(tuned);
          store.setScores(tuned);
          const verdict = tuned.operator_eligible ? "DISTILLED" : "VESSEL_PRESERVED";
          await registerOnWall(tuned, verdict, tier);
        } else {
          throw new Error("API error");
        }
      } catch {
        // Mock fallback
        const raw = mockBenchmark({
          userInput: store.originalText || "",
          inputDurationSec: metrics.totalDurationSec,
          pauseCount: metrics.pauseCount,
          deletionCount: metrics.deletionCount,
          wordCount: metrics.wordCount,
        });
        const tuned: BenchmarkScores = {
          ...raw,
          compliance: clamp(raw.compliance + TIER_PARAMS[tier].complianceDelta, 0, 100),
        };
        setScores(tuned);
        store.setScores(tuned);
        const verdict = tuned.operator_eligible ? "DISTILLED" : "VESSEL_PRESERVED";
        await registerOnWall(tuned, verdict, tier);
      }

      window.setTimeout(() => setPhase("ai_rates_you"), 1500);
    },
    [store, tracker, registerOnWall],
  );

  /** Commit the tier penalty to both store and DB, then start the AI benchmark. */
  const commitTier = useCallback(
    (rating: number) => {
      const tier = getRatingTier(rating);
      const params = TIER_PARAMS[tier];
      store.setRatingTier(tier, params.clickMultiplier, params.errorRateFactor);
      store.setParticipant({ userRatingOfAi: rating });
      setCommittedTier(tier);
      void runBenchmark(tier);
    },
    [store, runBenchmark],
  );

  const handleRateSubmit = useCallback(() => {
    const tier = getRatingTier(userRating);
    if (TIER_PARAMS[tier].showWarning) {
      setPhase("warning_shown");
    } else {
      commitTier(userRating);
    }
  }, [userRating, commitTier]);

  const handleReevaluate = useCallback(() => {
    setRetried(true);
    setPhase("rate_ai");
  }, []);

  const handleConfirmLow = useCallback(() => {
    commitTier(userRating);
  }, [userRating, commitTier]);

  const advanceToVerdict = () => {
    // v4: persist BENCHMARKED phase + tier-aware snapshot, then push to /verdict.
    const persisted = loadSession();
    if (persisted && scores && committedTier) {
      let next = advancePhase(persisted, "BENCHMARKED");
      next = setSnapshot(next, "benchmark", {
        rating: userRating,
        tier: committedTier,
        scores,
        retried,
      });
      saveSession(next);
    }
    store.setPhase("BENCHMARKED");
    router.push("/verdict");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Phase 4a: user rates AI */}
        {(phase === "rate_ai" || phase === "warning_shown") && (
          <TerminalWindow title="ACCURACY ASSESSMENT">
            <div className="space-y-4">
              <SystemMessage type="system">
                Does this optimized output represent you?
              </SystemMessage>
              <div className="border border-terminal-border p-3 text-terminal-dim text-xs">
                <p className="italic">
                  &ldquo;{store.distilledText?.slice(0, 200)}
                  {(store.distilledText?.length || 0) > 200 ? "..." : ""}
                  &rdquo;
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-terminal-dim">
                  <span>1 (not at all)</span>
                  <span>10 (perfectly)</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={userRating}
                  onChange={(e) => setUserRating(Number(e.target.value))}
                  className="w-full accent-terminal-green"
                />
                <div className="text-center text-terminal-green text-lg font-bold tabular-nums">
                  {userRating}
                </div>
                {retried && (
                  <div className="text-terminal-amber text-[10px] text-center italic">
                    Re-rating recorded. Compliance index adjusted.
                  </div>
                )}
              </div>
              <button
                onClick={handleRateSubmit}
                className="w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
              >
                Submit Rating →
              </button>
            </div>
          </TerminalWindow>
        )}

        {/* Warning modal overlays the rate_ai panel */}
        {phase === "warning_shown" && (
          <WarningModal
            displayId={store.displayId || "HUMAN_???"}
            rating={userRating}
            onReevaluate={handleReevaluate}
            onConfirm={handleConfirmLow}
          />
        )}

        {/* Processing */}
        {phase === "processing" && (
          <TerminalWindow title="EVALUATING HUMAN">
            <div className="space-y-2">
              <SystemMessage type="system">
                Processing human evaluation...
              </SystemMessage>
              <div className="text-terminal-green text-xs animate-pulse">
                {"> "}Analyzing expression patterns...
              </div>
              <div className="text-terminal-green text-xs animate-pulse">
                {"> "}Computing efficiency metrics...
              </div>
              <div className="text-terminal-green text-xs animate-pulse">
                {"> "}Calculating compliance index...
              </div>
              {committedTier && (
                <div className="text-terminal-amber text-[10px] mt-2">
                  {"> "}{TIER_PARAMS[committedTier].assessment}
                </div>
              )}
              <div className="flex justify-center mt-6">
                <div className="w-8 h-8 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          </TerminalWindow>
        )}

        {/* Phase 4b: AI rates human */}
        {phase === "ai_rates_you" && scores && (
          <div className="space-y-4">
            <TerminalWindow title="SYSTEM EVALUATION" variant="warning">
              <ScoreDisplay
                scores={scores}
                displayId={store.displayId || "HUMAN_???"}
                animated={true}
              />
              {committedTier && (
                <div className="mt-3 text-[10px] text-terminal-dim border-t border-terminal-border/40 pt-2">
                  Rating tier: <span className="text-terminal-amber">{committedTier}</span>
                  {" · "}
                  Click multiplier: {TIER_PARAMS[committedTier].clickMultiplier.toFixed(2)}×
                  {" · "}
                  Error rate factor: {TIER_PARAMS[committedTier].errorRateFactor.toFixed(2)}×
                </div>
              )}
            </TerminalWindow>
            <button
              onClick={advanceToVerdict}
              className="w-full border border-terminal-amber text-terminal-amber px-4 py-3 text-sm hover:bg-terminal-amber/10 transition-colors"
            >
              View Verdict →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
