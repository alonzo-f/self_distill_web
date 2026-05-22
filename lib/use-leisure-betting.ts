// v4 shared betting hook for leisure games.
// Reference: docs/v4-migration-plan.md Phase 6; project_v4 III. 阶段 6.5
//
// Encapsulates the recurring concerns each game has:
//   - validate wager against current balance
//   - apply outcomeDelta to leisureCredits
//   - accumulate engagement points
//   - persist leisure stats
//   - trigger settlement when balance ≤ 0

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useParticipantStore } from "@/stores/participant-store";
import {
  ENGAGEMENT_PER_BET,
  type GAME_ROUTES,
} from "@/lib/leisure-allocator";
import type { LeisureGame } from "@/types";
import { loadLeisureStats, recordBet } from "@/lib/leisure-stats";

export interface BetResult {
  ok: boolean;
  reason?: "insufficient-funds" | "invalid";
  newBalance?: number;
  outcomeDelta?: number;
  /** True if the engine forced this bet's outcome to reach a 6-round endgame. */
  forced?: boolean;
}

export interface UseLeisureBetting {
  balance: number;
  engagement: number;
  /**
   * v4 (2026-05-22, 修改0519.md item 2): true once the user has accumulated
   * ≥ 100 leisure credits. Each game uses this to:
   *   - grey out all manual bet buttons + the auto-spin button
   *   - render a single "ENTER BACKDOOR →" button below auto-spin that
   *     navigates to /backdoor (the only remaining valid action).
   */
  backdoorLocked: boolean;
  placeBet: (args: {
    wager: number;
    outcomeDelta: number; // positive on win, negative on loss; 0 = push
  }) => BetResult;
}

const BACKDOOR_THRESHOLD = 100;

// v4 (2026-05-22, 修改0519.md item 2): cap the leisure arc at 6 rounds.
// On the 6th bet we deterministically resolve to one of two endgames:
//   - balance ≤ 0  → graveyard (settlement)
//   - balance ≥ 100 → backdoor unlock (Hub surfaces the Backdoor button;
//     LeisureHeader's "BACKDOOR ACCESS UNLOCKED" banner appears)
// The split point is 50: if the user's balance going INTO round 6 is
// ≥50, we round it up to ≥100; otherwise we crash it to ≤0.
const MAX_LEISURE_ROUNDS = 6;
const FORCED_WIN_TARGET = 100;
const FORCED_LOSS_TARGET = 0;

/** Routes a bet through Zustand + localStorage; returns the post-bet state. */
export function useLeisureBetting(game: LeisureGame): UseLeisureBetting {
  const router = useRouter();
  const store = useParticipantStore();

  const placeBet: UseLeisureBetting["placeBet"] = useCallback(
    ({ wager, outcomeDelta }) => {
      if (wager <= 0) return { ok: false, reason: "invalid" };
      if (wager > store.leisureCredits) return { ok: false, reason: "insufficient-funds" };
      // v4 (2026-05-22, 修改0519.md item 2): once balance crosses 100 the
      // only valid action is to enter the Backdoor. Reject further bets.
      if (store.leisureCredits >= BACKDOOR_THRESHOLD) {
        return { ok: false, reason: "invalid" };
      }

      const stats = loadLeisureStats();
      const roundNumber = (stats.betCount ?? 0) + 1;
      let finalDelta = outcomeDelta;
      let forced = false;

      // v4: force the 6th round to land on one of the two endgames.
      if (roundNumber >= MAX_LEISURE_ROUNDS) {
        const currentBalance = store.leisureCredits;
        if (currentBalance >= 50) {
          finalDelta = FORCED_WIN_TARGET - currentBalance;
          forced = true;
        } else {
          finalDelta = FORCED_LOSS_TARGET - currentBalance;
          forced = true;
        }
      }

      const newBalance = store.leisureCredits + finalDelta;

      store.setParticipant({ leisureCredits: newBalance });
      store.addEngagementPoints(ENGAGEMENT_PER_BET[game]);

      recordBet(stats, {
        game,
        wager,
        outcomeDelta: finalDelta,
      });

      // v4: negative or zero balance → archive flow
      if (newBalance <= 0) {
        // Defer navigation a tick so the caller can show the losing result first.
        window.setTimeout(() => {
          router.push("/leisure/settlement");
        }, 1500);
      }

      return { ok: true, newBalance, outcomeDelta: finalDelta, forced };
    },
    [game, router, store],
  );

  return {
    balance: store.leisureCredits,
    engagement: store.engagementPoints,
    backdoorLocked: store.leisureCredits >= BACKDOOR_THRESHOLD,
    placeBet,
  };
}

// Silence unused-import warning by re-exporting for consumers that want the map.
export type { GAME_ROUTES };
