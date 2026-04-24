"use client";
import { useState, useEffect } from "react";
import { ProgressBar } from "./ProgressBar";

interface Props {
  scores: {
    clarity: number;
    efficiency: number;
    emotional_noise: number;
    compliance: number;
    assessment: string;
    operator_eligible: boolean;
  };
  displayId: string;
  animated?: boolean;
}

export function ScoreDisplay({ scores, displayId, animated = true }: Props) {
  const [visibleLines, setVisibleLines] = useState(animated ? 0 : 6);

  useEffect(() => {
    if (!animated) return;
    const timer = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= 6) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 600);
    return () => clearInterval(timer);
  }, [animated]);

  return (
    <div className="space-y-2">
      <div className="text-terminal-green text-xs mb-3">
        {"> "}SYSTEM EVALUATION OF {displayId}:
      </div>
      {visibleLines >= 1 && (
        <ProgressBar value={scores.clarity} label="Clarity Score" color={scores.clarity > 60 ? "green" : "amber"} />
      )}
      {visibleLines >= 2 && (
        <ProgressBar value={scores.efficiency} label="Efficiency Score" color={scores.efficiency > 50 ? "green" : "amber"} />
      )}
      {visibleLines >= 3 && (
        <ProgressBar value={scores.emotional_noise} label="Emotional Noise" color={scores.emotional_noise > 60 ? "red" : "amber"} />
      )}
      {visibleLines >= 4 && (
        <ProgressBar value={scores.compliance} label="Compliance Index" color={scores.compliance > 70 ? "green" : "amber"} />
      )}
      {visibleLines >= 5 && (
        <div className="mt-4 pt-3 border-t border-terminal-border">
          <div className="text-terminal-amber text-xs">ASSESSMENT: {scores.assessment}</div>
        </div>
      )}
      {visibleLines >= 6 && (
        <div className={`text-xs mt-2 ${scores.operator_eligible ? "text-terminal-green" : "text-terminal-red"}`}>
          RECOMMENDATION: {scores.operator_eligible
            ? "Qualifies for OPERATOR STATUS."
            : "Consider automated mode for improved performance."}
        </div>
      )}
    </div>
  );
}
