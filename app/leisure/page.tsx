"use client";

import { useState, useCallback } from "react";
import { useParticipantStore } from "@/stores/participant-store";

type GambleResult = { won: boolean; amount: number } | null;

export default function LeisurePage() {
  const store = useParticipantStore();
  const [lastResult, setLastResult] = useState<GambleResult>(null);
  const [showBackend, setShowBackend] = useState(false);
  const [backendName, setBackendName] = useState("");
  const [backendSubmitted, setBackendSubmitted] = useState(false);

  const credits = store.leisureCredits;
  const points = store.engagementPoints;

  const handleGamble = useCallback(
    (wager: number) => {
      if (credits < wager) return;

      const won = Math.random() > 0.55; // Slightly unfair odds
      const result = won ? wager : -wager;

      store.setParticipant({ leisureCredits: credits + result });
      const pointsGained = Math.ceil(wager / 10);
      store.addEngagementPoints(pointsGained);

      setLastResult({ won, amount: Math.abs(result) });

      // Check backend unlock
      if (
        store.engagementPoints + pointsGained >= 100 &&
        !store.backendUnlocked
      ) {
        store.unlockBackend();
        setTimeout(() => setShowBackend(true), 1200);
      }
    },
    [credits, store]
  );

  const handleAutoGamble = useCallback(() => {
    if (credits < 10) return;
    const netGain = Math.round(
      credits * 0.05 * (Math.random() > 0.3 ? 1 : -1)
    );
    const aiCut = Math.round(Math.abs(netGain) * 0.3);

    store.setParticipant({ leisureCredits: credits + netGain - aiCut });
    store.addEngagementPoints(5);

    setLastResult({ won: netGain > 0, amount: Math.abs(netGain) });

    if (store.engagementPoints + 5 >= 100 && !store.backendUnlocked) {
      store.unlockBackend();
      setTimeout(() => setShowBackend(true), 1200);
    }
  }, [credits, store]);

  const handleBackendSubmit = () => {
    if (!backendName.trim()) return;
    setBackendSubmitted(true);
  };

  // ──── Backend Access Screen ────
  if (showBackend && !backendSubmitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className="w-full max-w-md border border-terminal-green bg-terminal-bg p-6 space-y-4">
          <div className="text-terminal-green text-xs text-center tracking-widest">
            BACKEND ACCESS GRANTED
          </div>
          <div className="border border-terminal-border p-4 space-y-4">
            <p className="text-terminal-text text-sm text-center">
              You have reached the core of the system.
            </p>
            <div className="border-t border-terminal-border pt-4 space-y-2 text-center">
              <p className="text-terminal-dim text-xs">
                This system was built by:
              </p>
              <p className="text-terminal-text text-sm">
                BUILDER_01 — 编剧/导演
              </p>
              <p className="text-terminal-text text-sm">
                BUILDER_02 — 程序员
              </p>
              <p className="text-terminal-dim text-[10px] mt-3 italic">
                They were also the first to be evaluated.
              </p>
              <p className="text-terminal-dim text-[10px] italic">
                Their scores are on the wall.
              </p>
            </div>
            <div className="border-t border-terminal-border pt-4">
              <p className="text-terminal-text text-xs text-center mb-3">
                You found the backend.
                <br />
                Would you like to leave your mark?
              </p>
              <input
                type="text"
                value={backendName}
                onChange={(e) => setBackendName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-terminal-bg border border-terminal-border text-terminal-text text-sm p-2 font-mono focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim/40"
              />
              <button
                onClick={handleBackendSubmit}
                className="w-full mt-3 border border-terminal-green text-terminal-green px-4 py-2 text-sm hover:bg-terminal-green/10 transition-colors"
              >
                Leave Your Mark
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──── Final Screen ────
  if (backendSubmitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className="w-full max-w-md text-center space-y-8">
          <p className="text-terminal-green text-sm">
            Your identity has been added to the system&apos;s foundation.
          </p>
          <div className="space-y-2">
            <p className="text-terminal-dim text-xs">
              You didn&apos;t shut down the system.
            </p>
            <p className="text-terminal-dim text-xs">
              You became part of it.
            </p>
          </div>
          <div className="pt-12 space-y-3">
            <p className="text-terminal-dim text-[10px]">...</p>
            <p className="text-terminal-dim text-[10px]">
              But who is thanking whom?
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ──── Leisure Zone Main ────
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#1a1025" }}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl" style={{ color: "#ff6b9d" }}>
            Welcome to LEISURE ZONE ✧
          </h1>
          <p className="text-xs mt-1" style={{ color: "#e8d5f580" }}>
            Relax. Engage. Enjoy.
          </p>
        </div>

        {/* Credits */}
        <div className="text-center">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color: "#ffd700" }}
          >
            {credits}
          </span>
          <span className="text-xs ml-2" style={{ color: "#e8d5f560" }}>
            credits
          </span>
        </div>

        {/* Gamble panel */}
        <div
          className="border rounded-lg p-4 space-y-4"
          style={{
            borderColor: "#ff6b9d30",
            backgroundColor: "#1a102580",
          }}
        >
          <div
            className="text-center text-sm"
            style={{ color: "#ff6b9d" }}
          >
            ◆ RESOURCE GAMBLE ◆
          </div>

          {/* Result */}
          {lastResult && (
            <div
              className="text-center text-sm py-2 font-bold"
              style={{
                color: lastResult.won ? "#ffd700" : "#ff3333",
              }}
            >
              {lastResult.won
                ? `+${lastResult.amount} credits!`
                : `-${lastResult.amount} credits`}
            </div>
          )}

          {/* Wager buttons */}
          <div
            className="text-xs text-center"
            style={{ color: "#e8d5f560" }}
          >
            Wager your credits:
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[50, 100].map((amount) => (
              <button
                key={amount}
                onClick={() => handleGamble(amount)}
                disabled={credits < amount}
                className="border py-3 text-sm rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  borderColor: "#ff6b9d50",
                  color: "#ff6b9d",
                }}
              >
                {amount}
              </button>
            ))}
            <button
              onClick={() => handleGamble(credits)}
              disabled={credits < 1}
              className="border py-3 text-sm rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-bold"
              style={{
                borderColor: "#ffd70050",
                color: "#ffd700",
              }}
            >
              ALL IN
            </button>
          </div>

          {/* Auto-gamble */}
          <div
            className="border-t pt-3"
            style={{ borderColor: "#ff6b9d20" }}
          >
            <button
              onClick={handleAutoGamble}
              disabled={credits < 10}
              className="w-full border py-2 text-xs rounded transition-colors disabled:opacity-30"
              style={{
                borderColor: "#e8d5f530",
                color: "#e8d5f560",
              }}
            >
              AUTO-GAMBLE (steadier returns, AI keeps 30%)
            </button>
          </div>
        </div>

        {/* Engagement progress */}
        <div
          className="border rounded-lg p-3 space-y-2"
          style={{
            borderColor: "#ff6b9d20",
            backgroundColor: "#1a102550",
          }}
        >
          <div className="flex justify-between text-xs">
            <span style={{ color: "#e8d5f560" }}>ENGAGEMENT POINTS</span>
            <span style={{ color: "#ffd700" }}>{points}/100</span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "#1a1025" }}
          >
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${Math.min(100, points)}%`,
                backgroundColor: "#ffd700",
              }}
            />
          </div>
          <div
            className="text-center text-[10px]"
            style={{ color: "#e8d5f540" }}
          >
            Unlock at 100: [SYSTEM BACKEND ACCESS]
            <br />
            &ldquo;See what&apos;s behind the curtain.&rdquo;
          </div>
        </div>
      </div>
    </div>
  );
}
