"use client";

// v4 warning modal for benchmark rating ≤ 7.
// Reference: docs/v4-migration-plan.md Phase 4; project_v4 III. 阶段 4a.1
//
// Tone: polite, corporate-compliance-officer, mildly threatening with
// fake-but-plausible statistics. Two buttons:
//   [Re-evaluate]      → return to slider (caller marks `retried=true`)
//   [Confirm low rating] → commit current rating + apply tier penalty

import { TerminalWindow, SystemMessage } from "@/components/terminal";

interface WarningModalProps {
  displayId: string;
  rating: number;
  onReevaluate: () => void;
  onConfirm: () => void;
}

export function WarningModal({
  displayId,
  rating,
  onReevaluate,
  onConfirm,
}: WarningModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TerminalWindow title="OPTIMIZATION NOTICE">
          <div className="space-y-4">
            <SystemMessage type="warning">
              NOTICE: {displayId}
            </SystemMessage>
            <div className="text-terminal-text text-xs leading-relaxed">
              Your rating of {rating}/10 suggests low alignment with your
              optimized version.
            </div>
            <div className="text-terminal-dim text-[11px] leading-relaxed border border-terminal-border/60 p-3">
              Records indicate that participants with low alignment scores tend
              to experience:
              <ul className="mt-2 space-y-0.5 list-disc list-inside marker:text-terminal-amber/60">
                <li>23% higher error rate in production tasks</li>
                <li>41% greater latency in resource decisions</li>
                <li>Increased likelihood of leisure reassignment</li>
              </ul>
            </div>
            <div className="text-terminal-text text-xs">
              Would you like to reconsider your rating?
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={onReevaluate}
                className="w-full border border-terminal-green text-terminal-green px-4 py-2.5 text-sm hover:bg-terminal-green/10 transition-colors"
              >
                Re-evaluate
              </button>
              <button
                onClick={onConfirm}
                className="w-full border border-terminal-dim text-terminal-dim px-4 py-2 text-[11px] hover:text-terminal-amber hover:border-terminal-amber transition-colors"
              >
                Confirm low rating
              </button>
            </div>
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
