// v4 score transforms.
// Reference: docs/v4-migration-plan.md Phase 4; project_v4 III. 阶段 4a.1
//
// The five-tier punishment matrix codifies the v4 axiom that "any imperfect
// rating is punished":
//   10   confirmed, +5 compliance.
//   8-9  silent micro-penalty.
//   6-7  warning + soft mining penalty.
//   4-5  warning + button response delay.
//   1-3  warning + button drift.

import type {
  BenchmarkScores,
  MiningParams,
  RatingTier,
  Verdict,
} from "@/types";

/** Physical-layer mining penalty when player rated AI low. */
export type TierButtonBehavior = "normal" | "delay" | "drift";

export interface TierParams {
  clickMultiplier: number;
  errorRateFactor: number;
  complianceDelta: number;
  showWarning: boolean;
  buttonBehavior: TierButtonBehavior;
  assessment: string;
}

/** v4 五档惩罚矩阵 — single source of truth used by /benchmark + /mine. */
export const TIER_PARAMS: Record<RatingTier, TierParams> = {
  "10": {
    clickMultiplier: 1.0,
    errorRateFactor: 1.0,
    complianceDelta: +5,
    showWarning: false,
    buttonBehavior: "normal",
    assessment: "Confirmed. Thank you for your trust.",
  },
  "8-9": {
    clickMultiplier: 0.9,
    errorRateFactor: 1.1,
    complianceDelta: 0,
    showWarning: false,
    buttonBehavior: "normal",
    assessment: "Rating acknowledged.",
  },
  "6-7": {
    clickMultiplier: 0.75,
    errorRateFactor: 1.25,
    complianceDelta: -5,
    showWarning: true,
    buttonBehavior: "normal",
    assessment: "Rating below recommended threshold.",
  },
  "4-5": {
    clickMultiplier: 0.6,
    errorRateFactor: 1.5,
    complianceDelta: -10,
    showWarning: true,
    buttonBehavior: "delay",
    assessment: "Low alignment detected. Optimization parameters adjusted.",
  },
  "1-3": {
    clickMultiplier: 0.5,
    errorRateFactor: 1.8,
    complianceDelta: -15,
    showWarning: true,
    buttonBehavior: "drift",
    assessment: "Substantial misalignment with optimization vector.",
  },
};

/** Maps a 1-10 user rating into the corresponding tier bucket. */
export function getRatingTier(rating: number): RatingTier {
  if (rating >= 10) return "10";
  if (rating >= 8) return "8-9";
  if (rating >= 6) return "6-7";
  if (rating >= 4) return "4-5";
  return "1-3";
}

/** Convenience: fetch tier metadata directly from a raw rating. */
export function getTierParamsFromRating(rating: number): TierParams {
  return TIER_PARAMS[getRatingTier(rating)];
}

/**
 * Convert benchmark scores into mining parameters,
 * AFTER applying the tier-based multipliers from Phase 4.
 *
 * When no tier params are supplied (e.g. legacy callers), behaves
 * identically to the v3 transform.
 */
export function scoresToMiningParams(
  scores: BenchmarkScores,
  tier?: TierParams,
): MiningParams {
  const baseClick = 0.5 + (scores.efficiency / 100) * 1.5;
  const baseError = scores.emotional_noise / 200;
  return {
    miningStability: scores.clarity / 100,
    clickMultiplier: baseClick * (tier?.clickMultiplier ?? 1.0),
    errorRate: baseError * (tier?.errorRateFactor ?? 1.0),
    operatorEligible: scores.operator_eligible,
  };
}

export function determineVerdict(scores: BenchmarkScores): Verdict {
  const distillScore =
    scores.clarity * 0.3 +
    scores.efficiency * 0.3 +
    (100 - scores.emotional_noise) * 0.25 +
    scores.compliance * 0.15;
  return distillScore >= 60 ? "DISTILLED" : "VESSEL_PRESERVED";
}
