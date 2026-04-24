"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage, ScoreDisplay } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { useTypingTracker } from "@/stores/typing-tracker";
import { mockBenchmark } from "@/lib/ai/mock";
import type { BenchmarkScores } from "@/types";

type Phase = "rate_ai" | "processing" | "ai_rates_you";

export default function BenchmarkPage() {
  const router = useRouter();
  const store = useParticipantStore();
  const tracker = useTypingTracker();
  const [phase, setPhase] = useState<Phase>("rate_ai");
  const [userRating, setUserRating] = useState(5);
  const [scores, setScores] = useState<BenchmarkScores | null>(null);

  /** Push the participant's final data to the server-side wall registry */
  const registerOnWall = async (finalScores: BenchmarkScores, finalVerdict: string) => {
    if (!store.displayId) return;
    const output = Math.round(
      ((finalScores.clarity + finalScores.efficiency) / 2) * 5
    );
    try {
      await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: store.id || store.displayId,
          displayId: store.displayId,
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
        }),
      });
    } catch {
      // Non-critical — wall just won't show this participant
    }
  };

  const handleRateSubmit = useCallback(async () => {
    store.setParticipant({ userRatingOfAi: userRating });
    setPhase("processing");

    const metrics = tracker.getMetrics();

    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: store.id,
          promptText: "expression task",
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
        const data = await res.json();
        setScores(data);
        store.setScores(data);
        // Register on wall after scores are saved
        const verdict = data.operator_eligible ? "DISTILLED" : "VESSEL_PRESERVED";
        await registerOnWall(data, verdict);
      } else {
        throw new Error("API error");
      }
    } catch {
      // Mock fallback
      const mockScores = mockBenchmark({
        userInput: store.originalText || "",
        inputDurationSec: metrics.totalDurationSec,
        pauseCount: metrics.pauseCount,
        deletionCount: metrics.deletionCount,
        wordCount: metrics.wordCount,
      });
      setScores(mockScores);
      store.setScores(mockScores);
      const verdict = mockScores.operator_eligible ? "DISTILLED" : "VESSEL_PRESERVED";
      await registerOnWall(mockScores, verdict);
    }

    setTimeout(() => setPhase("ai_rates_you"), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRating, store, tracker]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Phase 4a: User rates AI */}
        {phase === "rate_ai" && (
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
                <div className="text-center text-terminal-green text-lg font-bold">
                  {userRating}
                </div>
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
            </TerminalWindow>
            <button
              onClick={() => router.push("/verdict")}
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
