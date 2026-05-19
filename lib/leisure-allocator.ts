// v4 leisure game allocator
// Reference: docs/v4-migration-plan.md Phase 6; project_v4 III. 阶段 6.5b
//
// The allocator is intentionally NOT random — the system "knows what will
// keep you here longest" and routes accordingly:
//
//   高服从 (Compliance ≥ 70) → SLOTS      — pure dissociation
//   低服从 (Compliance < 30) → BLACKJACK  — illusion of control
//   中间 (30 ≤ C < 70)      → GUESS       — simple decision

import type { LeisureGame } from "@/types";

export const SLOTS_THRESHOLD = 70;
export const BLACKJACK_THRESHOLD = 30;

export function allocateGame(compliance: number): LeisureGame {
  if (compliance >= SLOTS_THRESHOLD) return "SLOTS";
  if (compliance < BLACKJACK_THRESHOLD) return "BLACKJACK";
  return "GUESS";
}

/** Map game key to its dedicated route under /leisure. */
export const GAME_ROUTES: Record<LeisureGame, string> = {
  GUESS: "/leisure/guess",
  BLACKJACK: "/leisure/blackjack",
  SLOTS: "/leisure/slots",
};

/** Engagement points awarded per bet, independent of win/loss. */
export const ENGAGEMENT_PER_BET: Record<LeisureGame, number> = {
  GUESS: 3,
  BLACKJACK: 5,
  SLOTS: 2,
};
