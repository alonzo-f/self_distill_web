import type { BenchmarkScores, MiningParams, Verdict } from "@/types";

export function scoresToMiningParams(scores: BenchmarkScores): MiningParams {
  return {
    miningStability: scores.clarity / 100,
    clickMultiplier: 0.5 + (scores.efficiency / 100) * 1.5,
    errorRate: scores.emotional_noise / 200,
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
