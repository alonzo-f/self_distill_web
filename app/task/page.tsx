"use client";

// v4 expression task page.
// Reference: docs/v4-migration-plan.md Phase 2; project_v4 III. 阶段 2b
// - Random HR interview question
// - Hard 1-50 word range (typing past 50 is rejected; <1 disables submit)
// - 120s hard cap; auto-submits at zero
// - Keystroke tracker (pauses/deletions) still feeds Phase 4 benchmark

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage, Timer } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { useTypingTracker } from "@/stores/typing-tracker";
import {
  getRandomPrompt,
  countWords,
  WORD_LIMIT_MIN,
  WORD_LIMIT_MAX,
} from "@/lib/data/expression-prompts";
import type { ExpressionPrompt } from "@/types";
import { RouteGuard } from "@/components/RouteGuard";
import {
  loadSession,
  saveSession,
  advancePhase,
  setSnapshot,
} from "@/lib/local-storage";

export default function TaskPage() {
  return (
    <RouteGuard>
      <TaskContent />
    </RouteGuard>
  );
}

function TaskContent() {
  const router = useRouter();
  const store = useParticipantStore();
  const tracker = useTypingTracker();
  const [prompt] = useState<ExpressionPrompt>(() => getRandomPrompt());
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [limitFlash, setLimitFlash] = useState(false);
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

    // v4: hard upper bound on word count. Reject the edit if it would push past WORD_LIMIT_MAX.
    if (countWords(newText) > WORD_LIMIT_MAX) {
      // Flash a visual cue but do NOT update state — caret stays where it was.
      setLimitFlash(true);
      window.setTimeout(() => setLimitFlash(false), 400);
      return;
    }

    // Detect deletion vs addition for the typing tracker
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

  const wordCount = countWords(text);
  const meetsMin = wordCount >= WORD_LIMIT_MIN;
  const atMax = wordCount >= WORD_LIMIT_MAX;

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    if (countWords(text) < WORD_LIMIT_MIN) return;
    setSubmitted(true);

    // v4: persist the actual prompt so /distill + /benchmark can pass it to the AI.
    store.setParticipant({
      promptKey: prompt.key,
      promptText: prompt.text,
      originalText: text,
      status: "EXPRESSING",
    });

    // v4: persist phase + immutable snapshot before navigating
    const metrics = tracker.getMetrics();
    const persisted = loadSession();
    if (persisted) {
      let next = advancePhase(persisted, "EXPRESSED");
      next = setSnapshot(next, "expression", {
        promptKey: prompt.key,
        promptText: prompt.text,
        userInput: text,
        metrics,
      });
      saveSession(next);
    }
    store.setPhase("EXPRESSED");

    // Navigate to distill with a brief delay
    setTimeout(() => router.push("/distill"), 800);
  }, [text, submitted, store, router, prompt, tracker]);

  const handleTimeUp = useCallback(() => {
    if (submitted) return;
    // v4: if the user did not even write 1 word in 120s, do NOT auto-submit empty.
    // The state machine will keep them at EXPRESSED=false; in practice the
    // Phase 3 router guard will bounce them back here on next entry.
    if (countWords(text) >= WORD_LIMIT_MIN) {
      handleSubmit();
    }
  }, [submitted, text, handleSubmit]);

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
              Please answer the following interview question.
            </SystemMessage>
            <SystemMessage type="info">
              Your answer will be processed by our optimization system.
            </SystemMessage>

            {/* Prompt */}
            <div className="border border-terminal-amber/50 bg-terminal-amber/5 px-4 py-3">
              <p className="text-terminal-text text-base italic">
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
                rows={6}
                className={`w-full bg-terminal-bg border text-terminal-text text-sm p-4 font-mono resize-none focus:outline-none placeholder:text-terminal-dim/40 disabled:opacity-50 ${
                  limitFlash
                    ? "border-terminal-red animate-pulse"
                    : atMax
                      ? "border-terminal-amber focus:border-terminal-amber"
                      : "border-terminal-border focus:border-terminal-green"
                }`}
              />
              <div
                className={`absolute bottom-2 right-2 text-[10px] tabular-nums ${
                  atMax ? "text-terminal-amber" : "text-terminal-dim"
                }`}
              >
                {wordCount} / {WORD_LIMIT_MAX} words
                <span className="ml-2 opacity-70">(min {WORD_LIMIT_MIN})</span>
              </div>
            </div>

            {limitFlash && (
              <div className="text-terminal-red text-[10px]">
                Word limit reached. The system requires concision.
              </div>
            )}

            {/* Hidden metrics display */}
            <div className="flex justify-between text-terminal-dim text-[10px]">
              <span>Pauses: {tracker.pauseCount}</span>
              <span>Revisions: {tracker.deletionCount}</span>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitted || !meetsMin}
              className={`w-full border px-4 py-3 text-sm transition-colors ${
                !submitted && meetsMin
                  ? "border-terminal-green text-terminal-green hover:bg-terminal-green/10"
                  : "border-terminal-border text-terminal-dim cursor-not-allowed"
              }`}
            >
              {submitted
                ? "Submitting..."
                : meetsMin
                  ? "Submit Expression →"
                  : "Write at least 1 word"}
            </button>
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
