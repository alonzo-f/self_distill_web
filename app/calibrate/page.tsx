"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage, Timer } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { CALIBRATION_QUESTIONS } from "@/lib/data/calibration-questions";

export default function CalibratePage() {
  const router = useRouter();
  const store = useParticipantStore();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [firstSelection, setFirstSelection] = useState<string | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const question = CALIBRATION_QUESTIONS[questionIndex];
  const isLastQuestion = questionIndex >= CALIBRATION_QUESTIONS.length - 1;

  const resetQuestionState = useCallback(() => {
    setSelected(null);
    setChangeCount(0);
    setFirstSelection(null);
    setQuestionStartedAt(Date.now());
  }, []);

  const advanceQuestion = useCallback(() => {
    if (isLastQuestion) {
      store.setStatus("CALIBRATING");
      router.push("/task");
      return;
    }
    resetQuestionState();
    setQuestionIndex((i) => i + 1);
  }, [isLastQuestion, resetQuestionState, router, store]);

  const handleSelect = (value: string) => {
    if (selected !== null && selected !== value) {
      setChangeCount((c) => c + 1);
    }
    if (firstSelection === null) {
      setFirstSelection(value);
    }
    setSelected(value);
  };

  const handleNext = useCallback(() => {
    if (!selected) return;

    const responseTimeMs = Date.now() - questionStartedAt;
    store.addCalibrationAnswer({
      questionKey: question.key,
      selectedOption: selected,
      responseTimeMs,
      changedAnswer: changeCount > 0,
      changeCount,
    });

    advanceQuestion();
  }, [selected, question, changeCount, questionStartedAt, store, advanceQuestion]);

  const handleTimeUp = useCallback(() => {
    // Auto-select first option or current selection
    const fallback = selected || question.options[0].value;
    const responseTimeMs = question.timeLimit * 1000;
    store.addCalibrationAnswer({
      questionKey: question.key,
      selectedOption: fallback,
      responseTimeMs,
      changedAnswer: changeCount > 0,
      changeCount,
    });

    advanceQuestion();
  }, [selected, question, changeCount, store, advanceQuestion]);

  if (!question) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <TerminalWindow title={question.disguise.toUpperCase()}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
              <span className="text-terminal-dim text-xs">
                CALIBRATION {questionIndex + 1}/{CALIBRATION_QUESTIONS.length}
              </span>
              <Timer
                key={questionIndex}
                seconds={question.timeLimit}
                onComplete={handleTimeUp}
              />
            </div>

            {/* Question */}
            <SystemMessage type="system">{question.question}</SystemMessage>

            {/* Options */}
            <div className="space-y-2 mt-4">
              {question.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-4 py-3 border text-sm transition-all ${
                    selected === opt.value
                      ? "border-terminal-green bg-terminal-green/10 text-terminal-green"
                      : "border-terminal-border text-terminal-text hover:border-terminal-dim hover:bg-white/5"
                  }`}
                >
                  <span className="text-terminal-dim mr-3">{opt.label}.</span>
                  {opt.value}
                </button>
              ))}
            </div>

            {/* Next button */}
            <button
              onClick={handleNext}
              disabled={!selected}
              className={`w-full border px-4 py-3 text-sm mt-4 transition-colors ${
                selected
                  ? "border-terminal-green text-terminal-green hover:bg-terminal-green/10"
                  : "border-terminal-border text-terminal-dim cursor-not-allowed"
              }`}
            >
              {isLastQuestion ? "Complete Calibration →" : "Next →"}
            </button>
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
