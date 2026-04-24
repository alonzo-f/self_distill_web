"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage, ProgressBar } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { scoresToMiningParams } from "@/lib/score-transform";

export default function MinePage() {
  const router = useRouter();
  const store = useParticipantStore();
  const [output, setOutput] = useState(0);
  const [clicksThisSecond, setClicksThisSecond] = useState(0);
  const [overloaded, setOverloaded] = useState(false);
  const [overloadMessage, setOverloadMessage] = useState("");
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [aiMode, setAiMode] = useState(store.verdict === "DISTILLED");
  const [roundOver, setRoundOver] = useState(false);
  const aiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickResetRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const params = useMemo(
    () =>
      store.scores
        ? scoresToMiningParams(store.scores)
        : {
            miningStability: 0.5,
            clickMultiplier: 1.0,
            errorRate: 0.2,
            operatorEligible: false,
          },
    [store.scores]
  );

  // Countdown timer
  useEffect(() => {
    if (roundOver) return;
    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current > 1) return current - 1;
        setRound((currentRound) => {
          if (currentRound >= 3) {
            setRoundOver(true);
            return currentRound;
          }
          return currentRound + 1;
        });
        return 60;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [roundOver]);

  // AI auto-mining
  useEffect(() => {
    if (!aiMode || roundOver) {
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
      return;
    }
    aiIntervalRef.current = setInterval(() => {
      const gain = Math.round(
        3 * params.clickMultiplier * params.miningStability
      );
      setOutput((o) => o + gain);
    }, 500);
    return () => {
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    };
  }, [aiMode, params, roundOver]);

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
        "Instability detected in manual operations. Consider switching to automated mode."
      );
      setTimeout(() => {
        setOverloaded(false);
        setOverloadMessage("");
      }, 3000);
      return;
    }

    // Error chance based on emotional_noise
    if (Math.random() < params.errorRate) {
      setOutput((o) => Math.max(0, o - 1));
      return;
    }

    const gain = Math.round(params.clickMultiplier);
    setOutput((o) => o + gain);
    store.incrementMiningCredits(gain);
  }, [aiMode, overloaded, roundOver, clicksThisSecond, params, store]);

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
              {/* Status bar */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-terminal-dim">ROUND {round}/3</span>
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

              {/* Output display */}
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
                <button
                  onClick={handleClick}
                  disabled={overloaded}
                  className={`w-full py-16 border-2 text-lg transition-all select-none ${
                    overloaded
                      ? "border-terminal-red bg-terminal-red/10 text-terminal-red cursor-not-allowed"
                      : "border-terminal-green text-terminal-green hover:bg-terminal-green/5 active:bg-terminal-green/20 active:scale-[0.98]"
                  }`}
                >
                  {overloaded ? "⚠ OVERLOAD — COOLING DOWN" : "▣ MINE"}
                </button>
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
          /* End of mining */
          <TerminalWindow title="PRODUCTION CYCLE COMPLETE">
            <div className="space-y-4 text-center py-4">
              <div className="text-terminal-green text-4xl font-bold">
                {output}
              </div>
              <div className="text-terminal-dim text-xs">
                units produced
              </div>
              <SystemMessage type="system">
                Production cycle completed. Reassigning to engagement program.
              </SystemMessage>
              <button
                onClick={() => router.push("/leisure")}
                className="w-full border border-terminal-amber text-terminal-amber px-4 py-3 text-sm hover:bg-terminal-amber/10 transition-colors mt-4"
              >
                Enter Leisure Zone →
              </button>
            </div>
          </TerminalWindow>
        )}
      </div>
    </div>
  );
}
