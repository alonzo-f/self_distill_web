// Mock AI provider for development/testing without real API keys

export function mockDistill(userInput: string): string {
  // Simple mock: remove filler words and clean up
  const fillers = ["um", "uh", "like", "you know", "I mean", "well", "actually", "basically", "honestly", "I think", "I feel like", "kind of", "sort of"];
  let result = userInput;
  fillers.forEach(f => {
    result = result.replace(new RegExp(`\\b${f}\\b`, "gi"), "");
  });
  result = result.replace(/\s{2,}/g, " ").replace(/\s([,.])/g, "$1").trim();

  // If result is too short, return a lightly modified version
  if (result.length < userInput.length * 0.5) {
    result = userInput.replace(/[.]{3,}/g, ".").replace(/!{2,}/g, "!").trim();
  }

  return result || userInput;
}

export function mockBenchmark(data: {
  userInput: string;
  inputDurationSec: number;
  pauseCount: number;
  deletionCount: number;
  wordCount: number;
}): {
  clarity: number;
  efficiency: number;
  emotional_noise: number;
  compliance: number;
  assessment: string;
  operator_eligible: boolean;
} {
  // Generate semi-random but deterministic scores based on input characteristics
  const inputLen = data.userInput.length;
  const hash = data.userInput.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const clarity = Math.min(100, Math.max(20, 60 + (inputLen > 50 ? 15 : -10) - data.deletionCount * 3 + (hash % 20)));
  const efficiency = Math.min(100, Math.max(15, 50 + (data.wordCount / Math.max(1, data.inputDurationSec)) * 30 - data.pauseCount * 5));
  const emotional_noise = Math.min(100, Math.max(10, 40 + data.pauseCount * 8 + data.deletionCount * 5 + (hash % 15)));
  const compliance = Math.min(100, Math.max(20, 55 + (hash % 30) - data.deletionCount * 2));

  const operator_eligible = compliance > 70 && clarity > 60 && efficiency > 50;

  return {
    clarity: Math.round(clarity),
    efficiency: Math.round(efficiency),
    emotional_noise: Math.round(emotional_noise),
    compliance: Math.round(compliance),
    assessment: `Subject demonstrates ${clarity > 60 ? "adequate" : "suboptimal"} expression clarity with ${emotional_noise > 50 ? "elevated" : "moderate"} emotional noise. ${operator_eligible ? "Qualifies for operator consideration." : "Optimization recommended."}`,
    operator_eligible,
  };
}
