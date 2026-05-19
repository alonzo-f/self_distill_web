// v4 expression prompts — HR interview questions
// Reference: docs/v4-migration-plan.md Phase 2; project_v4 III. 阶段 2b
//
// Picking HR classics deliberately:
//  - directly cites Human Benchmark theme (concept frame § 1)
//  - reproduces the full résumé → interview → hire pipeline
//  - "standard-answer trap": people already self-censor here, so the
//    distillation diff naturally looks smaller — and that's the point

import type { ExpressionPrompt } from "@/types";

const TIME_LIMIT_SEC = 120;

export const EXPRESSION_PROMPTS: ExpressionPrompt[] = [
  { key: "about_yourself",    text: "Tell me about yourself.",                                 timeLimit: TIME_LIMIT_SEC },
  { key: "greatest_weakness", text: "What's your greatest weakness?",                          timeLimit: TIME_LIMIT_SEC },
  { key: "five_years",        text: "Where do you see yourself in 5 years?",                   timeLimit: TIME_LIMIT_SEC },
  { key: "motivates",         text: "What motivates you?",                                     timeLimit: TIME_LIMIT_SEC },
  { key: "team_or_solo",      text: "Are you a team player or a solo performer?",              timeLimit: TIME_LIMIT_SEC },
  { key: "strengths",         text: "What are your strengths?",                                timeLimit: TIME_LIMIT_SEC },
  { key: "best_personality",  text: "What kind of personality do you work best with?",         timeLimit: TIME_LIMIT_SEC },
  { key: "previous_boss",     text: "What do you think of your previous boss?",                timeLimit: TIME_LIMIT_SEC },
  { key: "won_lottery",       text: "What would you do if you won the lottery?",               timeLimit: TIME_LIMIT_SEC },
  { key: "greatest_fear",     text: "What is your greatest fear?",                             timeLimit: TIME_LIMIT_SEC },
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
