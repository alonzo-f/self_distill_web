// v4 expression prompts — HR interview questions
// Reference: docs/v4-migration-plan.md Phase 2; project_v4 III. 阶段 2b
//
// Picking HR classics deliberately:
//  - directly cites Human Benchmark theme (concept frame § 1)
//  - reproduces the full résumé → interview → hire pipeline
//  - "standard-answer trap": people already self-censor here, so the
//    distillation diff naturally looks smaller — and that's the point
//
// v4 (2026-05-22): every prompt now ships with a pre-written referenceAnswer
// (the "ideal optimized AI output", ≤50 words). After the user submits their
// answer on /task, the matching referenceAnswer is shown on /distill as the
// "optimized output" — the user then rates THAT on /benchmark.

import type { ExpressionPrompt } from "@/types";

const TIME_LIMIT_SEC = 120;

export const EXPRESSION_PROMPTS: ExpressionPrompt[] = [
  {
    key: "about_yourself",
    text: "Tell me about yourself.",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "Results-driven professional with proven experience in problem-solving and cross-functional collaboration. Core strengths: analytical thinking, clear communication, and adaptive learning. I consistently deliver measurable outcomes through structured execution. Outside work, I invest in continuous skill development. This role aligns with my growth trajectory and offers meaningful long-term impact.",
  },
  {
    key: "greatest_weakness",
    text: "What's your greatest weakness?",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "I tend to over-invest in detail to ensure quality output. I've addressed this by setting explicit time boundaries on tasks and trusting peer review earlier in the process. This calibration has improved both my delivery speed and team collaboration while preserving the standards I value most.",
  },
  {
    key: "five_years",
    text: "Where do you see yourself in 5 years?",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "Growing into a senior contributor role: deepening domain expertise while expanding cross-functional impact. I want to lead initiatives that drive measurable business outcomes, mentor newer team members, and continue building strategic capabilities aligned with company priorities and the evolving demands of the industry.",
  },
  {
    key: "motivates",
    text: "What motivates you?",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "Solving complex problems with clear, measurable impact. Seeing my work improve systems, unblock colleagues, or drive quantifiable outcomes sustains my energy. I'm equally motivated by continuous learning — mastering new domains, refining technique, and translating insight into execution that advances both individual and team objectives.",
  },
  {
    key: "team_or_solo",
    text: "Are you a team player or a solo performer?",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "Both — context decides. I collaborate effectively in teams: listening actively, building on others' ideas, and aligning execution around shared goals. I also deliver independently on focused, high-ownership work. I adapt deliberately, choosing the mode that maximizes outcomes and minimizes friction for the situation at hand.",
  },
  {
    key: "strengths",
    text: "What are your strengths?",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "Analytical thinking, clear communication, and adaptive learning. I decompose complex problems into actionable steps, translate technical work for diverse stakeholders, and rapidly acquire new skills when priorities shift. These strengths combine to deliver consistent execution across changing contexts, technical domains, and team configurations.",
  },
  {
    key: "best_personality",
    text: "What kind of personality do you work best with?",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "Direct, intellectually curious colleagues who value honest feedback and clear expectations. I thrive alongside people who balance high standards with psychological safety — who debate ideas openly while respecting each perspective. That combination produces the strongest output and the most sustainable working relationships over time.",
  },
  {
    key: "previous_boss",
    text: "What do you think of your previous boss?",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "Strategic and trusting. They set clear goals while granting genuine autonomy, provided direct feedback that accelerated my growth, and modeled disciplined prioritization. I appreciated their balance of high standards with consistent support, and I carry several of their leadership practices forward into my own work.",
  },
  {
    key: "won_lottery",
    text: "What would you do if you won the lottery?",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "Secure financial stability first, then fund initiatives with long-term meaning — education, research, or community infrastructure. I'd continue working in a field I care about, because purpose drives my fulfillment more than financial pressure ever has. The win would unlock greater contribution, not retirement.",
  },
  {
    key: "greatest_fear",
    text: "What is your greatest fear?",
    timeLimit: TIME_LIMIT_SEC,
    referenceAnswer:
      "Stagnation. Reaching a point where I'm no longer learning, growing, or contributing meaningfully would be deeply unfulfilling. I'm driven by continuous improvement, so a static environment — professionally or personally — concerns me far more than typical setbacks, which I view simply as learning opportunities.",
  },
];

/** v4: hard word-count range for open-ended responses. */
export const WORD_LIMIT_MIN = 1;
export const WORD_LIMIT_MAX = 50;

/** Picks one prompt at random per visit. */
export function getRandomPrompt(): ExpressionPrompt {
  return EXPRESSION_PROMPTS[Math.floor(Math.random() * EXPRESSION_PROMPTS.length)];
}

/** Returns the word count of a string using the same rule the UI displays. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Lookup a prompt's referenceAnswer by key. Returns null if key not found. */
export function getReferenceAnswer(key: string | null | undefined): string | null {
  if (!key) return null;
  const p = EXPRESSION_PROMPTS.find((p) => p.key === key);
  return p?.referenceAnswer ?? null;
}
