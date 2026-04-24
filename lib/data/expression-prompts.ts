import type { ExpressionPrompt } from "@/types";

export const EXPRESSION_PROMPTS: ExpressionPrompt[] = [
  {
    key: "unexplainable",
    text: "The thing I can never quite explain to anyone is...",
    timeLimit: 120,
  },
  {
    key: "future_message",
    text: "If I could send one message to myself ten years from now, I would say...",
    timeLimit: 120,
  },
  {
    key: "changed_mind",
    text: "The last time I changed my mind about something important was...",
    timeLimit: 120,
  },
  {
    key: "disappeared",
    text: "If I disappeared tomorrow, the thing people would get wrong about me is...",
    timeLimit: 120,
  },
];

export function getRandomPrompt(): ExpressionPrompt {
  return EXPRESSION_PROMPTS[Math.floor(Math.random() * EXPRESSION_PROMPTS.length)];
}
