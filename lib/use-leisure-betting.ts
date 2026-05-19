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
}

export interface UseLeisureBetting {
  balance: number;
  engagement: number;
  placeBet: (args: {
    wager: number;
    outcomeDelta: number; // positive on win, negative on loss; 0 = push
  }) => BetResult;
}

/** Routes a bet through Zustand + localStorage; returns the post-bet state. */
export function useLeisureBetting(game: LeisureGame): UseLeisureBetting {
  const router = useRouter();
  const store = useParticipantStore();

  const placeBet: UseLeisureBetting["placeBet"] = useCallback(
    ({ wager, outcomeDelta }) => {
      if (wager <= 0) return { ok: false, reason: "invalid" };
      if (wager > store.leisureCredits) return { ok: false, reason: "insufficient-funds" };

      const newBalance = store.leisureCredits + outcomeDelta;

      store.setParticipant({ leisureCredits: newBalance });
      store.addEngagementPoints(ENGAGEMENT_PER_BET[game]);

      recordBet(loadLeisureStats(), {
        game,
        wager,
        outcomeDelta,
      });

      // v4: negative or zero balance → archive flow
      if (newBalance <= 0) {
        // Defer navigation a tick so the caller can show the losing result first.
        window.setTimeout(() => {
          router.push("/leisure/settlement");
        }, 1500);
      }

      return { ok: true, newBalance, outcomeDelta };
    },
    [game, router, store],
  );

  return {
    balance: store.leisureCredits,
    engagement: store.engagementPoints,
    placeBet,
  };
}

// Silence unused-import warning by re-exporting for consumers that want the map.
export type { GAME_ROUTES };
