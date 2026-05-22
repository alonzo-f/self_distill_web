"use client";

// v4 leisure game: SLOTS (老虎机).
// Reference: docs/v4-migration-plan.md Phase 6; project_v4 III. 阶段 6.5b
//
// 3-reel slots with three symbols.
// Cost 10 credits per spin.
// Match-3: 5x payout (net +40)
// Match-2: 1.5x payout (net +5)
// No match: -10
// AUTO-SPIN runs 5 spins back-to-back.

import { useCallback, useEffect, useRef, useState } from "react";
import { SystemMessage } from "@/components/terminal";
import { RouteGuard } from "@/components/RouteGuard";
import { HubButton } from "@/components/HubButton";
import { LeisureHeader } from "@/components/LeisureHeader";
import { ForcedBackdoorButton } from "@/components/ForcedBackdoorButton";
import { useLeisureBetting } from "@/lib/use-leisure-betting";

const SYMBOLS = ["◉", "◎", "▣"] as const;
type Symbol = (typeof SYMBOLS)[number];

const SPIN_COST = 10;
const MATCH3_PAYOUT = 50;
const MATCH2_PAYOUT = 15;

interface LastSpin {
  reels: Symbol[];
  outcome: "match3" | "match2" | "none";
  delta: number;
}

function spinReel(): Symbol {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export default function SlotsPage() {
  return (
    <RouteGuard>
      <HubButton />
      <SlotsContent />
    </RouteGuard>
  );
}

function SlotsContent() {
  const { balance, engagement, placeBet, backdoorLocked } = useLeisureBetting("SLOTS");
  const [reels, setReels] = useState<Symbol[]>(["◉", "◎", "▣"]);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState<LastSpin | null>(null);
  const [autoCount, setAutoCount] = useState(0);
  const autoActiveRef = useRef(false);

  const spin = useCallback(async () => {
    if (spinning) return;
    if (balance < SPIN_COST) return;
    setSpinning(true);

    // Animation: flicker for ~600ms
    const start = Date.now();
    const flicker = setInterval(() => {
      setReels([spinReel(), spinReel(), spinReel()]);
      if (Date.now() - start > 600) clearInterval(flicker);
    }, 80);

    await new Promise((r) => setTimeout(r, 700));
    clearInterval(flicker);

    const finalReels: Symbol[] = [spinReel(), spinReel(), spinReel()];
    setReels(finalReels);

    let outcome: LastSpin["outcome"];
    let payout: number;
    if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
      outcome = "match3";
      payout = MATCH3_PAYOUT;
    } else if (
      finalReels[0] === finalReels[1] ||
      finalReels[1] === finalReels[2] ||
      finalReels[0] === finalReels[2]
    ) {
      outcome = "match2";
      payout = MATCH2_PAYOUT;
    } else {
      outcome = "none";
      payout = 0;
    }

    const delta = payout - SPIN_COST;
    const res = placeBet({ wager: SPIN_COST, outcomeDelta: delta });
    if (res.ok) setLast({ reels: finalReels, outcome, delta });
    setSpinning(false);
  }, [balance, placeBet, spinning]);

  const startAuto = useCallback(() => {
    if (autoActiveRef.current) return;
    autoActiveRef.current = true;
    setAutoCount(5);
  }, []);

  // Auto-spin loop
  useEffect(() => {
    if (autoCount <= 0 || spinning) return;
    if (!autoActiveRef.current) return;
    void (async () => {
      await spin();
      setAutoCount((c) => {
        const next = c - 1;
        if (next <= 0) autoActiveRef.current = false;
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCount, spinning]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">
        <LeisureHeader balance={balance} engagement={engagement} game="SLOTS" />

        <div className="rounded-2xl border border-terminal-amber/40 bg-gradient-to-b from-terminal-bg to-terminal-amber/5 p-5 space-y-4">
          <div className="text-center text-terminal-amber text-sm tracking-widest">
            ◆ EXPRESSION SLOTS ◆
          </div>
          <SystemMessage type="info">
            10 credits/spin · Match 3 = 5× · Match 2 = 1.5×
          </SystemMessage>

          {/* Reels */}
          <div className="grid grid-cols-3 gap-2">
            {reels.map((s, i) => (
              <div
                key={i}
                className={`aspect-square rounded-xl border-2 flex items-center justify-center text-5xl ${
                  spinning
                    ? "border-terminal-amber/50 text-terminal-amber animate-pulse"
                    : "border-terminal-green/60 text-terminal-green"
                }`}
              >
                {s}
              </div>
            ))}
          </div>

          <button
            onClick={spin}
            disabled={spinning || balance < SPIN_COST || autoCount > 0 || backdoorLocked}
            className="w-full py-3 rounded-md border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-sm tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {spinning ? "SPINNING..." : "▣ SPIN (-10)"}
          </button>

          <button
            onClick={startAuto}
            disabled={spinning || balance < SPIN_COST * 5 || autoCount > 0 || backdoorLocked}
            className="w-full py-2 rounded-md border border-terminal-dim text-terminal-dim text-[11px] hover:border-terminal-amber hover:text-terminal-amber transition-colors disabled:opacity-40"
          >
            ⚡ AUTO-SPIN ×5 {autoCount > 0 ? `(${autoCount} left)` : ""}
          </button>

          <ForcedBackdoorButton visible={backdoorLocked} />
        </div>

        {/* Result */}
        {last && (
          <div
            className={`rounded-xl border p-3 text-center space-y-1 ${
              last.outcome === "match3"
                ? "border-terminal-green/60 bg-terminal-green/5 text-terminal-green"
                : last.outcome === "match2"
                  ? "border-terminal-amber/60 bg-terminal-amber/5 text-terminal-amber"
                  : "border-terminal-red/60 bg-terminal-red/5 text-terminal-red"
            }`}
          >
            <div className="text-2xl font-bold uppercase">
              {last.outcome === "match3" ? "JACKPOT" : last.outcome === "match2" ? "PAIR" : "MISS"}
            </div>
            <div className="text-[11px] tracking-widest">
              {last.delta > 0 ? "+" : ""}
              {last.delta} credits
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
