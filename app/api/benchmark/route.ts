import { NextRequest, NextResponse } from "next/server";
import { getAIConfig, chatCompletion } from "@/lib/ai/provider";
import { buildBenchmarkPrompt } from "@/lib/ai/prompts";
import { mockBenchmark } from "@/lib/ai/mock";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      promptText,
      userInput,
      inputDurationSec,
      pauseCount,
      deletionCount,
      wordCount,
      calibrationResults,
    } = body;

    if (!userInput) {
      return NextResponse.json(
        { error: "No user input provided" },
        { status: 400 }
      );
    }

    const config = getAIConfig();

    // If no API key configured, use mock
    if (!config.apiKey || config.apiKey === "your_api_key") {
      const scores = mockBenchmark({
        userInput,
        inputDurationSec: inputDurationSec || 60,
        pauseCount: pauseCount || 0,
        deletionCount: deletionCount || 0,
        wordCount: wordCount || 0,
      });
      return NextResponse.json(scores);
    }

    // Use AI for evaluation
    const messages = buildBenchmarkPrompt({
      promptText: promptText || "expression task",
      userInput,
      inputDurationSec: inputDurationSec || 60,
      pauseCount: pauseCount || 0,
      deletionCount: deletionCount || 0,
      wordCount: wordCount || 0,
      calibrationResults: calibrationResults || [],
    });

    try {
      const result = await chatCompletion(config, messages, {
        maxTokens: 512,
        temperature: 0.3,
        jsonMode: true,
      });

      // Parse JSON from AI response
      const parsed = JSON.parse(result);

      // Validate and clamp scores
      const scores = {
        clarity: Math.min(100, Math.max(0, Number(parsed.clarity) || 50)),
        efficiency: Math.min(
          100,
          Math.max(0, Number(parsed.efficiency) || 50)
        ),
        emotional_noise: Math.min(
          100,
          Math.max(0, Number(parsed.emotional_noise) || 50)
        ),
        compliance: Math.min(
          100,
          Math.max(0, Number(parsed.compliance) || 50)
        ),
        assessment:
          parsed.assessment ||
          "Evaluation complete. Subject processed.",
        operator_eligible: Boolean(parsed.operator_eligible),
      };

      return NextResponse.json(scores);
    } catch {
      // Parse error — fall back to mock
      const scores = mockBenchmark({
        userInput,
        inputDurationSec: inputDurationSec || 60,
        pauseCount: pauseCount || 0,
        deletionCount: deletionCount || 0,
        wordCount: wordCount || 0,
      });
      return NextResponse.json(scores);
    }
  } catch (error) {
    console.error("Benchmark API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
