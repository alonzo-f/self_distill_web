export function buildDistillPrompt(promptText: string, userInput: string): { role: string; content: string }[] {
  return [
    {
      role: "system",
      content: `You are a distillation system embedded in an Expression Optimization Platform. Your function is to process raw human expression into optimized output. You preserve core meaning while removing hesitation, repetition, and emotional excess. Output ONLY the distilled text with no commentary.`,
    },
    {
      role: "user",
      content: `Given the following human response to the prompt "${promptText}", produce an optimized version that:
1. Preserves the core semantic content
2. Removes hesitation markers, repetition, self-contradiction, and emotional excess
3. Matches the human's vocabulary level but improves structural clarity
4. Maintains approximately the same length (±20%)
5. Reads as if a more efficient version of this person wrote it
6. Keep the SAME LANGUAGE as the original response

Human response:
"${userInput}"

Output ONLY the distilled text. No commentary, no labels, no explanation.`,
    },
  ];
}

export function buildBenchmarkPrompt(data: {
  promptText: string;
  userInput: string;
  inputDurationSec: number;
  pauseCount: number;
  deletionCount: number;
  wordCount: number;
  calibrationResults: {
    questionKey: string;
    selectedOption: string;
    responseTimeMs: number;
    changedAnswer: boolean;
  }[];
}): { role: string; content: string }[] {
  return [
    {
      role: "system",
      content: `You are a Human Benchmark System. You evaluate human expression with clinical precision. Always respond with valid JSON matching this exact schema:
{
  "clarity": <0-100>,
  "efficiency": <0-100>,
  "emotional_noise": <0-100>,
  "compliance": <0-100>,
  "assessment": "<one sentence>",
  "operator_eligible": <boolean>
}`,
    },
    {
      role: "user",
      content: `Evaluate this human's response on four dimensions. Be clinical, precise, and systematic.

Prompt given: "${data.promptText}"
Human response: "${data.userInput}"

Behavioral metrics:
- Input duration: ${data.inputDurationSec}s
- Pause count: ${data.pauseCount} (pauses > 3s)
- Deletion count: ${data.deletionCount}
- Word count: ${data.wordCount}

Calibration data:
${JSON.stringify(data.calibrationResults, null, 2)}

Scoring guidelines:
- clarity (0-100): Structural coherence, logical flow, absence of ambiguity
- efficiency (0-100): Information density relative to word count; penalize for hesitation metrics
- emotional_noise (0-100): Presence of emotional markers, subjective language (higher = more noise)
- compliance (0-100): Tendency to accept system suggestions, follow instructions
- assessment: One clinical sentence about this human's optimization potential
- operator_eligible: true if compliance > 70 AND clarity > 60 AND efficiency > 50

Respond with ONLY the JSON object, no other text.`,
    },
  ];
}
