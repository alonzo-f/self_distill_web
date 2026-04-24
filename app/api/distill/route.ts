import { NextRequest, NextResponse } from "next/server";
import {
  getAIConfig,
  streamChatCompletion,
  chatCompletion,
} from "@/lib/ai/provider";
import { buildDistillPrompt } from "@/lib/ai/prompts";
import { mockDistill } from "@/lib/ai/mock";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { promptText, userInput } = body;

    if (!userInput || userInput.trim().length === 0) {
      return NextResponse.json(
        { error: "No user input provided" },
        { status: 400 }
      );
    }

    const config = getAIConfig();

    // If no API key configured, use mock
    if (!config.apiKey || config.apiKey === "your_api_key") {
      const distilledText = mockDistill(userInput);
      return NextResponse.json({ distilledText });
    }

    // Try streaming response
    const messages = buildDistillPrompt(promptText, userInput);

    try {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullText = "";
            for await (const token of streamChatCompletion(config, messages, {
              maxTokens: 1024,
              temperature: 0.7,
            })) {
              fullText += token;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: token })}\n\n`
                )
              );
            }
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  full_text: fullText,
                })}\n\n`
              )
            );
            controller.close();
          } catch {
            // On streaming error, fall back to mock
            const fallback = mockDistill(userInput);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  full_text: fallback,
                })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch {
      // Fall back to non-streaming
      const result = await chatCompletion(config, messages, {
        maxTokens: 1024,
        temperature: 0.7,
      });
      return NextResponse.json({ distilledText: result });
    }
  } catch (error) {
    console.error("Distill API error:", error);
    // Always return a mock response rather than failing
    const body = await req.clone().json().catch(() => ({ userInput: "" }));
    const distilledText = mockDistill(body.userInput || "");
    return NextResponse.json({ distilledText });
  }
}
