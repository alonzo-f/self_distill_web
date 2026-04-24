"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  TerminalWindow,
  SystemMessage,
  ProgressBar,
} from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";

type Phase = "processing" | "reveal" | "comparison";

const PROCESSING_STEPS = [
  "Analyzing expression patterns...",
  "Mapping personality vectors from calibration data...",
  "Extracting style signature from open response...",
  "Cross-referencing with optimization database...",
  "Generating optimized version...",
];

export default function DistillPage() {
  const router = useRouter();
  const store = useParticipantStore();
  const [phase, setPhase] = useState<Phase>("processing");
  const [processingStep, setProcessingStep] = useState(0);
  const [distilledText, setDistilledText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [, setStreamComplete] = useState(false);

  const originalText = store.originalText || "No expression data found.";

  const startDistillation = useCallback(async () => {
    setPhase("reveal");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: store.id,
          promptText: "expression task",
          userInput: originalText,
        }),
      });

      if (!res.ok) throw new Error("API error");

      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        // SSE streaming
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  fullText += data.text;
                  setDistilledText(fullText);
                }
                if (data.done) {
                  fullText = data.full_text || fullText;
                  setDistilledText(fullText);
                }
              } catch {}
            }
          }
        }
        store.setParticipant({
          distilledText: fullText,
          status: "DISTILLING",
        });
      } else {
        // JSON response (mock mode)
        const data = await res.json();
        // Simulate streaming effect
        const text = data.distilledText;
        for (let i = 0; i <= text.length; i++) {
          await new Promise((r) => setTimeout(r, 15));
          setDistilledText(text.slice(0, i));
        }
        store.setParticipant({
          distilledText: text,
          status: "DISTILLING",
        });
      }
    } catch {
      // Fallback: simple mock distillation
      const mockText = originalText
        .replace(
          /\b(um|uh|like|you know|I mean|well|actually|basically)\b/gi,
          ""
        )
        .replace(/\s{2,}/g, " ")
        .trim();
      for (let i = 0; i <= mockText.length; i++) {
        await new Promise((r) => setTimeout(r, 15));
        setDistilledText(mockText.slice(0, i));
      }
      store.setParticipant({
        distilledText: mockText,
        status: "DISTILLING",
      });
    }

    setIsStreaming(false);
    setStreamComplete(true);
    setTimeout(() => setPhase("comparison"), 800);
  }, [store, originalText]);

  // Processing animation
  useEffect(() => {
    if (phase !== "processing") return;
    if (processingStep >= PROCESSING_STEPS.length) {
      const timer = setTimeout(() => startDistillation(), 500);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(
      () => setProcessingStep((s) => s + 1),
      800 + Math.random() * 400
    );
    return () => clearTimeout(timer);
  }, [phase, processingStep, startDistillation]);

  // Estimate noise level based on text difference
  const noiseLevel =
    originalText.length > 0
      ? Math.round(
          (Math.abs(originalText.length - distilledText.length) /
            originalText.length) *
            100
        )
      : 50;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* PROCESSING */}
        {phase === "processing" && (
          <TerminalWindow title="DISTILLATION IN PROGRESS">
            <div className="space-y-2">
              <SystemMessage type="system">
                PROCESSING: Initiating distillation sequence...
              </SystemMessage>
              {PROCESSING_STEPS.slice(0, processingStep).map((step, i) => (
                <div key={i} className="text-terminal-green text-xs">
                  {">"} {step}
                </div>
              ))}
              {processingStep < PROCESSING_STEPS.length && (
                <div className="text-terminal-amber text-xs animate-pulse">
                  {">"} {PROCESSING_STEPS[processingStep]}
                </div>
              )}
            </div>
          </TerminalWindow>
        )}

        {/* REVEAL — streaming distilled text */}
        {phase === "reveal" && (
          <TerminalWindow title="GENERATING OPTIMIZED VERSION">
            <div className="space-y-3">
              <SystemMessage type="system">Distillation in progress...</SystemMessage>
              <div className="border border-terminal-green/30 bg-terminal-green/5 p-4 min-h-[100px]">
                <p className="text-terminal-text text-sm whitespace-pre-wrap">
                  {distilledText}
                  {isStreaming && (
                    <span className="animate-pulse text-terminal-green">█</span>
                  )}
                </p>
              </div>
            </div>
          </TerminalWindow>
        )}

        {/* COMPARISON — side by side */}
        {phase === "comparison" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <TerminalWindow title="YOUR INPUT">
                <div className="space-y-3">
                  <p className="text-terminal-text text-sm whitespace-pre-wrap min-h-[100px]">
                    {originalText}
                  </p>
                  <div className="pt-2 border-t border-terminal-border space-y-1">
                    <ProgressBar
                      value={Math.min(95, noiseLevel + 30)}
                      label="Emotional Noise"
                      color="amber"
                    />
                    <ProgressBar
                      value={Math.max(10, 70 - noiseLevel)}
                      label="Clarity Index"
                      color="amber"
                    />
                  </div>
                </div>
              </TerminalWindow>

              {/* Distilled */}
              <TerminalWindow title="OPTIMIZED OUTPUT" variant="success">
                <div className="space-y-3">
                  <p className="text-terminal-text text-sm whitespace-pre-wrap min-h-[100px]">
                    {distilledText}
                  </p>
                  <div className="pt-2 border-t border-terminal-border space-y-1">
                    <ProgressBar
                      value={Math.max(5, noiseLevel - 20)}
                      label="Emotional Noise"
                      color="green"
                    />
                    <ProgressBar
                      value={Math.min(98, 90 + noiseLevel / 5)}
                      label="Clarity Index"
                      color="green"
                    />
                  </div>
                </div>
              </TerminalWindow>
            </div>

            <button
              onClick={() => router.push("/benchmark")}
              className="w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
            >
              Proceed to Evaluation →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
