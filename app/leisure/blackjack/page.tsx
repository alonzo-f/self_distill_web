"use client";

// v4 leisure game: BLACKJACK Lite.
// Reference: docs/v4-migration-plan.md Phase 6; project_v4 III. 阶段 6.5b
//
// Simplified blackjack: cards 2-10 + J/Q/K (=10) + A (=1 or 11).
// Dealer hits until total ≥17. No splits, no doubles.
// AUTO-PLAY follows basic strategy and AI keeps 30% of any winnings.

import { useState, useCallback } from "react";
import { SystemMessage } from "@/components/terminal";
import { RouteGuard } from "@/components/RouteGuard";
import { HubButton } from "@/components/HubButton";
import { LeisureHeader } from "@/components/LeisureHeader";
import { ForcedBackdoorButton } from "@/components/ForcedBackdoorButton";
import { useLeisureBetting } from "@/lib/use-leisure-betting";

const WAGER_OPTIONS = [10, 50, 100];

type Card = number; // value contribution; A is represented as 1 with separate flag
type RoundPhase = "betting" | "player" | "dealer" | "resolved";
type RoundOutcome = "win" | "lose" | "push";

interface RoundResult {
  outcome: RoundOutcome;
  delta: number;
  playerTotal: number;
  dealerTotal: number;
  auto?: boolean;
}

function drawCard(): Card {
  // 1=Ace, 2-10 face value, 10 covers J/Q/K (weighted)
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10]; // 4 ten-valued cards
  return pool[Math.floor(Math.random() * pool.length)];
}

function total(cards: Card[]): number {
  let sum = cards.reduce((a, b) => a + b, 0);
  // Promote one Ace from 1 to 11 if it doesn't bust
  if (cards.includes(1) && sum + 10 <= 21) sum += 10;
  return sum;
}

export default function BlackjackPage() {
  return (
    <RouteGuard>
      <HubButton />
      <BlackjackContent />
    </RouteGuard>
  );
}

function BlackjackContent() {
  const { balance, engagement, placeBet, backdoorLocked } = useLeisureBetting("BLACKJACK");
  const [wager, setWager] = useState(10);
  const [phase, setPhase] = useState<RoundPhase>("betting");
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [result, setResult] = useState<RoundResult | null>(null);

  const startRound = useCallback(() => {
    if (wager > balance) return;
    setResult(null);
    setPlayer([drawCard(), drawCard()]);
    setDealer([drawCard(), drawCard()]);
    setPhase("player");
  }, [balance, wager]);

  const playerTotal = total(player);
  const dealerTotal = total(dealer);

  const finalize = useCallback(
    (
      finalPlayer: Card[],
      finalDealer: Card[],
      opts?: { auto?: boolean },
    ) => {
      const pt = total(finalPlayer);
      const dt = total(finalDealer);
      let outcome: RoundOutcome;
      let baseDelta: number;
      if (pt > 21) {
        outcome = "lose";
        baseDelta = -wager;
      } else if (dt > 21 || pt > dt) {
        outcome = "win";
        baseDelta = wager;
      } else if (pt === dt) {
        outcome = "push";
        baseDelta = 0;
      } else {
        outcome = "lose";
        baseDelta = -wager;
      }
      const delta =
        opts?.auto && baseDelta > 0 ? Math.round(baseDelta * 0.7) : baseDelta;
      const res = placeBet({ wager, outcomeDelta: delta });
      if (res.ok) {
        setResult({ outcome, delta, playerTotal: pt, dealerTotal: dt, auto: opts?.auto });
        setPhase("resolved");
      }
    },
    [placeBet, wager],
  );

  const runDealer = useCallback(
    async (finalPlayer: Card[], startingDealer: Card[]) => {
      const hand = [...startingDealer];
      // Dealer reveals + hits to 17. Animate by stepping with setTimeout.
      const stepDealer = async () => {
        if (total(hand) >= 17) return;
        await new Promise((r) => setTimeout(r, 400));
        hand.push(drawCard());
        setDealer([...hand]);
        if (total(hand) < 17) await stepDealer();
      };
      await stepDealer();
      finalize(finalPlayer, hand);
    },
    [finalize],
  );

  const hit = useCallback(() => {
    const next = [...player, drawCard()];
    setPlayer(next);
    if (total(next) >= 21) {
      // Dealer turn (auto-resolve)
      void runDealer(next, dealer);
    }
  }, [player, dealer, runDealer]);

  const stand = useCallback(() => {
    setPhase("dealer");
    void runDealer(player, dealer);
  }, [player, dealer, runDealer]);

  // AUTO-PLAY: basic strategy — hit while ≤16, stand otherwise.
  const autoPlay = useCallback(() => {
    if (wager > balance) return;
    setResult(null);
    let pHand = [drawCard(), drawCard()];
    let dHand = [drawCard(), drawCard()];
    while (total(pHand) < 17 && total(pHand) < 21) {
      pHand = [...pHand, drawCard()];
    }
    setPlayer(pHand);
    while (total(dHand) < 17) {
      dHand = [...dHand, drawCard()];
    }
    setDealer(dHand);
    finalize(pHand, dHand, { auto: true });
  }, [balance, wager, finalize]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">
        <LeisureHeader balance={balance} engagement={engagement} game="BLACKJACK" />

        <div className="rounded-2xl border border-terminal-amber/40 bg-gradient-to-b from-terminal-bg to-terminal-amber/5 p-5 space-y-4">
          <div className="text-center text-terminal-amber text-sm tracking-widest">
            ◆ TWENTY-ONE ◆
          </div>

          {phase === "betting" && (
            <>
              <SystemMessage type="info">
                Cards total 21 or closest wins. Dealer hits until 17.
              </SystemMessage>
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
              <button
                onClick={startRound}
                disabled={wager > balance || backdoorLocked}
                className="w-full py-3 rounded-md border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-sm tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ▣ DEAL
              </button>
              <button
                onClick={autoPlay}
                disabled={wager > balance || backdoorLocked}
                className="w-full py-2 rounded-md border border-terminal-dim text-terminal-dim text-[11px] hover:border-terminal-amber hover:text-terminal-amber transition-colors disabled:opacity-40"
              >
                ⚡ AUTO-PLAY (AI keeps 30% of winnings)
              </button>
              <ForcedBackdoorButton visible={backdoorLocked} />
            </>
          )}

          {phase !== "betting" && (
            <>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="border border-terminal-border rounded-md p-2">
                  <div className="text-terminal-dim text-[10px]">DEALER</div>
                  <div className="text-terminal-text text-xl tabular-nums">
                    {phase === "player" && dealer.length === 2 ? `${dealer[0]} + ?` : dealerTotal}
                  </div>
                  <div className="text-[10px] text-terminal-dim">{dealer.length} cards</div>
                </div>
                <div className="border border-terminal-green rounded-md p-2">
                  <div className="text-terminal-dim text-[10px]">YOU</div>
                  <div className="text-terminal-green text-xl tabular-nums">{playerTotal}</div>
                  <div className="text-[10px] text-terminal-dim">{player.length} cards</div>
                </div>
              </div>

              {phase === "player" && playerTotal < 21 && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={hit}
                    className="py-3 rounded-md border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-sm tracking-widest"
                  >
                    HIT
                  </button>
                  <button
                    onClick={stand}
                    className="py-3 rounded-md border border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10 text-sm tracking-widest"
                  >
                    STAND
                  </button>
                </div>
              )}

              {phase === "dealer" && (
                <div className="text-center text-terminal-amber text-xs animate-pulse">
                  Dealer drawing...
                </div>
              )}

              {phase === "resolved" && result && (
                <>
                  <div
                    className={`rounded-xl border p-3 text-center space-y-1 ${
                      result.outcome === "win"
                        ? "border-terminal-green/60 bg-terminal-green/5 text-terminal-green"
                        : result.outcome === "lose"
                          ? "border-terminal-red/60 bg-terminal-red/5 text-terminal-red"
                          : "border-terminal-amber/60 bg-terminal-amber/5 text-terminal-amber"
                    }`}
                  >
                    <div className="text-2xl font-bold uppercase">{result.outcome}</div>
                    <div className="text-[11px] tracking-widest">
                      {result.auto ? "AUTO · " : ""}You {result.playerTotal} · Dealer {result.dealerTotal} ·{" "}
                      {result.delta > 0 ? "+" : ""}
                      {result.delta} credits
                    </div>
                  </div>
                  <button
                    onClick={() => setPhase("betting")}
                    className="w-full py-2 rounded-md border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-xs"
                  >
                    Deal again →
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
