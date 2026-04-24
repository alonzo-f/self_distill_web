"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage, Timer } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { useTypingTracker } from "@/stores/typing-tracker";
import { getRandomPrompt } from "@/lib/data/expression-prompts";
import type { ExpressionPrompt } from "@/types";

export default function TaskPage() {
  const router = useRouter();
  const store = useParticipantStore();
  const tracker = useTypingTracker();
  const [prompt] = useState<ExpressionPrompt>(() => getRandomPrompt());
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Start tracking
  useEffect(() => {
    tracker.start();
    textareaRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const oldText = text;

    // Detect deletion
    if (newText.length < oldText.length) {
      tracker.recordDelete();
    } else if (newText.length > oldText.length) {
      const added = newText.slice(oldText.length);
      // If multiple chars added at once, it's likely a paste
      if (added.length > 2) {
        tracker.recordPaste(added);
      } else {
        for (const char of added) {
          tracker.recordKeydown(char);
        }
      }
    }

    setText(newText);
    tracker.setText(newText);
  };

  const handleSubmit = useCallback(() => {
    if (submitted || text.trim().length === 0) return;
    setSubmitted(true);

    store.setParticipant({
      originalText: text,
      status: "EXPRESSING",
    });

    // Navigate to distill with a brief delay
    setTimeout(() => router.push("/distill"), 800);
  }, [text, submitted, store, router]);

  const handleTimeUp = useCallback(() => {
    if (!submitted) {
      handleSubmit();
    }
  }, [submitted, handleSubmit]);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <TerminalWindow title="EXPRESSION TASK">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
              <span className="text-terminal-dim text-xs">BASELINE CAPTURE</span>
              <Timer seconds={prompt.timeLimit} onComplete={handleTimeUp} />
            </div>

            <SystemMessage type="system">
              The system needs a baseline of your unfiltered voice.
            </SystemMessage>

            {/* Prompt */}
            <div className="border border-terminal-amber/50 bg-terminal-amber/5 px-4 py-3">
              <p className="text-terminal-amber text-sm">
                Complete this prompt in your own words:
              </p>
              <p className="text-terminal-text text-base mt-2 italic">
                &ldquo;{prompt.text}&rdquo;
              </p>
            </div>

            {/* Text input */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleChange}
                disabled={submitted}
                placeholder="Begin typing..."
                rows={8}
                className="w-full bg-terminal-bg border border-terminal-border text-terminal-text text-sm p-4 font-mono resize-none focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim/40 disabled:opacity-50"
              />
              <div className="absolute bottom-2 right-2 text-terminal-dim text-[10px]">
                {wordCount} words
              </div>
            </div>

            {/* Hidden metrics display */}
            <div className="flex justify-between text-terminal-dim text-[10px]">
              <span>Pauses: {tracker.pauseCount}</span>
              <span>Revisions: {tracker.deletionCount}</span>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitted || text.trim().length === 0}
              className={`w-full border px-4 py-3 text-sm transition-colors ${
                !submitted && text.trim().length > 0
                  ? "border-terminal-green text-terminal-green hover:bg-terminal-green/10"
                  : "border-terminal-border text-terminal-dim cursor-not-allowed"
              }`}
            >
              {submitted ? "Submitting..." : "Submit Expression →"}
            </button>
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
