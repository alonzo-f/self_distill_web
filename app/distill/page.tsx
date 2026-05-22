"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  TerminalWindow,
  SystemMessage,
  ProgressBar,
} from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { RouteGuard } from "@/components/RouteGuard";
import { getReferenceAnswer } from "@/lib/data/expression-prompts";
import {
  loadSession,
  saveSession,
  advancePhase,
  setSnapshot,
} from "@/lib/local-storage";

type Phase = "processing" | "reveal" | "comparison";

const PROCESSING_STEPS = [
  "Analyzing expression patterns...",
  "Mapping personality vectors from calibration data...",
  "Extracting style signature from open response...",
  "Cross-referencing with optimization database...",
  "Generating optimized version...",
];

export default function DistillPage() {
  return (
    <RouteGuard>
      <DistillContent />
    </RouteGuard>
  );
}

function DistillContent() {
  const router = useRouter();
  const store = useParticipantStore();
  const [phase, setPhase] = useState<Phase>("processing");
  const [processingStep, setProcessingStep] = useState(0);
  const [distilledText, setDistilledText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [, setStreamComplete] = useState(false);
  const [surrenderConfirm, setSurrenderConfirm] = useState(false);

  const originalText = store.originalText || "No expression data found.";

  const startDistillation = useCallback(async () => {
    setPhase("reveal");
    setIsStreaming(true);

    // v4 (2026-05-22): the "optimized output" is now the pre-written
    // referenceAnswer for the matching HR question — not a live AI distillation
    // of the user's text. This guarantees a consistent, fair benchmark target
    // for the user to rate on /benchmark.
    const reference = getReferenceAnswer(store.promptKey);
    const text =
      reference ??
      // Fallback: if somehow promptKey is missing, mock-clean the user input
      // so the page still has something to show.
      originalText
        .replace(
          /\b(um|uh|like|you know|I mean|well|actually|basically)\b/gi,
          "",
        )
        .replace(/\s{2,}/g, " ")
        .trim();

    // Stream the reference answer character-by-character to preserve the
    // "AI is generating" feel.
    for (let i = 0; i <= text.length; i++) {
      await new Promise((r) => setTimeout(r, 15));
      setDistilledText(text.slice(0, i));
    }

    store.setParticipant({
      distilledText: text,
      status: "DISTILLING",
    });

    // v4 (2026-05-22, 修改0519.md item 4): persist the user's input and
    // distilled output server-side so the digital passport can render
    // them later. Best-effort — memory store handles it when Supabase
    // is offline.
    if (store.id) {
      try {
        await fetch("/api/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: store.id,
            displayId: store.displayId,
            displayName: store.displayName || null,
            originalText,
            distilledText: text,
            status: "DISTILLING",
          }),
        });
      } catch {
        /* non-fatal */
      }
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
              onClick={() => {
                // v4: persist DISTILLED_VIEWED phase + snapshot before navigating
                const persisted = loadSession();
                if (persisted) {
                  let next = advancePhase(persisted, "DISTILLED_VIEWED");
                  if (store.distilledText) {
                    next = setSnapshot(next, "distillation", {
                      distilledText: store.distilledText,
                    });
                  }
                  saveSession(next);
                }
                store.setPhase("DISTILLED_VIEWED");
                router.push("/benchmark");
              }}
              className="w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
            >
              Proceed to Evaluation →
            </button>

            {/* v4 调整: 做题完成后, 用户可自愿进入坟场 (不可逆) */}
            <button
              onClick={() => setSurrenderConfirm(true)}
              className="w-full border border-terminal-dim text-terminal-dim/80 px-4 py-2 text-[11px] hover:text-terminal-red hover:border-terminal-red transition-colors"
            >
              Surrender to Archive
            </button>

            {surrenderConfirm && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-sm border border-terminal-red bg-terminal-bg p-4 space-y-3">
                  <div className="text-terminal-red text-xs tracking-widest">
                    IRREVERSIBLE
                  </div>
                  <div className="text-terminal-text text-xs leading-relaxed">
                    Surrendering will archive your profile immediately and lock
                    you into Ghost Observer mode. You will not be evaluated,
                    you will not produce, you will not earn credits.
                    <br />
                    <br />
                    This decision cannot be undone within this session.
                  </div>
                  <button
                    onClick={() => setSurrenderConfirm(false)}
                    className="w-full border-2 border-terminal-green text-terminal-green bg-terminal-green/10 px-4 py-2 text-sm hover:bg-terminal-green/20 transition-colors"
                  >
                    ▣ Continue with Evaluation
                  </button>
                  <button
                    onClick={() => {
                      router.push("/leisure/settlement?reason=surrender");
                    }}
                    className="w-full border border-terminal-red text-terminal-red px-4 py-2 text-[11px] hover:bg-terminal-red/10 transition-colors"
                  >
                    Confirm — archive me now
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
