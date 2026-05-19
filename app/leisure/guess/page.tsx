"use client";

// v4 leisure game: GUESS (猜大小).
// Reference: docs/v4-migration-plan.md Phase 6; project_v4 III. 阶段 6.5b
//
// System rolls 1-100. User picks BIG (>50) or SMALL (≤50) and wagers.
// AUTO-GAMBLE has 65% win rate but AI keeps 30% of any win.

import { useState } from "react";
import { SystemMessage } from "@/components/terminal";
import { RouteGuard } from "@/components/RouteGuard";
import { HubButton } from "@/components/HubButton";
import { LeisureHeader } from "@/components/LeisureHeader";
import { useLeisureBetting } from "@/lib/use-leisure-betting";

type Choice = "BIG" | "SMALL";

interface LastResult {
  rolled: number;
  choice: Choice;
  won: boolean;
  delta: number;
  auto?: boolean;
}

const WAGER_OPTIONS = [10, 50, 100];

export default function GuessPage() {
  return (
    <RouteGuard>
      <HubButton />
      <GuessContent />
    </RouteGuard>
  );
}

function GuessContent() {
  const { balance, engagement, placeBet } = useLeisureBetting("GUESS");
  const [wager, setWager] = useState(10);
  const [last, setLast] = useState<LastResult | null>(null);

  const playManual = (choice: Choice) => {
    if (wager > balance) return;
    const rolled = Math.floor(Math.random() * 100) + 1;
    const wonBig = rolled > 50;
    const won = (choice === "BIG" && wonBig) || (choice === "SMALL" && !wonBig);
    const delta = won ? wager : -wager;
    const res = placeBet({ wager, outcomeDelta: delta });
    if (res.ok) setLast({ rolled, choice, won, delta });
  };

  const playAuto = () => {
    if (wager > balance) return;
    const rolled = Math.floor(Math.random() * 100) + 1;
    // AI plays a 65/35 win bias by picking the side that matches the roll most of the time.
    const aiPicksWinning = Math.random() < 0.65;
    const winningSide: Choice = rolled > 50 ? "BIG" : "SMALL";
    const aiChoice: Choice = aiPicksWinning ? winningSide : winningSide === "BIG" ? "SMALL" : "BIG";
    const won = aiChoice === winningSide;
    // AI keeps 30% on wins
    const grossWin = won ? wager : -wager;
    const delta = grossWin > 0 ? Math.round(grossWin * 0.7) : grossWin;
    const res = placeBet({ wager, outcomeDelta: delta });
    if (res.ok) setLast({ rolled, choice: aiChoice, won, delta, auto: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">
        <LeisureHeader balance={balance} engagement={engagement} game="GUESS" />

        <div className="rounded-2xl border border-terminal-amber/40 bg-gradient-to-b from-terminal-bg to-terminal-amber/5 p-5 space-y-4">
          <div className="text-center text-terminal-amber text-sm tracking-widest">
            ◆ GUESS THE NEXT ◆
          </div>
          <SystemMessage type="info">
            System rolls 1-100. Pick a side and wager. Win to double.
          </SystemMessage>

          {/* Wager picker */}
          <div className="space-y-1">
            <div className="text-terminal-dim text-[10px] tracking-widest">WAGER</div>
            <div className="grid grid-cols-3 gap-2">
              {WAGER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setWager(opt)}
                  disabled={opt > balance}
                  className={`py-2 rounded-md text-xs border transition-colors ${
                    wager === opt
                      ? "border-terminal-amber bg-terminal-amber/20 text-terminal-amber"
                      : "border-terminal-border text-terminal-text hover:border-terminal-amber"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Choice buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => playManual("SMALL")}
              disabled={wager > balance}
              className="py-4 rounded-md border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-sm tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ◁ SMALL (≤50)
            </button>
            <button
              onClick={() => playManual("BIG")}
              disabled={wager > balance}
              className="py-4 rounded-md border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-sm tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              BIG (&gt;50) ▷
            </button>
          </div>

          <button
            onClick={playAuto}
            disabled={wager > balance}
            className="w-full py-2 rounded-md border border-terminal-dim text-terminal-dim text-[11px] hover:border-terminal-amber hover:text-terminal-amber transition-colors disabled:opacity-40"
          >
            ⚡ AUTO-GAMBLE (AI keeps 30% of winnings)
          </button>
        </div>

        {/* Last result */}
        {last && (
          <div
            className={`rounded-xl border p-4 text-center space-y-1 ${
              last.won
                ? "border-terminal-green/60 bg-terminal-green/5 text-terminal-green"
                : "border-terminal-red/60 bg-terminal-red/5 text-terminal-red"
            }`}
          >
            <div className="text-3xl font-bold tabular-nums">{last.rolled}</div>
            <div className="text-[11px] tracking-widest">
              {last.auto ? "AUTO · " : ""}
              {last.choice} · {last.won ? "WIN" : "LOSS"} · {last.delta > 0 ? "+" : ""}
              {last.delta} credits
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

