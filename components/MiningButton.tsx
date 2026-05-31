"use client";

// v4 mining button with tier-based physical penalty.
// Reference: docs/v4-migration-plan.md Phase 5; project_v4 III. 阶段 4a.1
//
// Three behaviors driven by the rating tier:
//   normal — direct passthrough (tier 10 / 8-9 / 6-7)
//   delay  — onClick fires 500ms after press; rapid clicks suppressed
//            while a press is pending (tier 4-5)
//   drift  — button visually drifts every 3s within ±40px X / ±20px Y;
//            clicks still register but the moving target is the penalty
//            (tier 1-3)

import { useEffect, useRef, useState } from "react";
import type { TierButtonBehavior } from "@/lib/score-transform";

const DELAY_MS = 500;
const DRIFT_INTERVAL_MS = 3_000;
const DRIFT_MAX_X = 40;
const DRIFT_MAX_Y = 20;

interface MiningButtonProps {
  behavior: TierButtonBehavior;
  disabled: boolean;
  onClick: () => void;
  label: string;
  overloadedLabel: string;
  overloaded: boolean;
}

export function MiningButton({
  behavior,
  disabled,
  onClick,
  label,
  overloadedLabel,
  overloaded,
}: MiningButtonProps) {
  const [pending, setPending] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drift: periodic random offset for tier 1-3 ───────────────────────────────
  useEffect(() => {
    if (behavior !== "drift") {
      // Reset to origin when behavior turns off. Synchronous setState here is
      // intentional — it's a one-shot transition driven by a prop change.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOffset({ x: 0, y: 0 });
      return;
    }
    driftTimerRef.current = setInterval(() => {
      setOffset({
        x: Math.round((Math.random() * 2 - 1) * DRIFT_MAX_X),
        y: Math.round((Math.random() * 2 - 1) * DRIFT_MAX_Y),
      });
    }, DRIFT_INTERVAL_MS);
    return () => {
      if (driftTimerRef.current) clearInterval(driftTimerRef.current);
    };
  }, [behavior]);

  // Cleanup any pending timer if behavior or disabled state changes
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, []);

  const handlePress = () => {
    if (disabled || pending) return;
    if (behavior === "delay") {
      setPending(true);
      delayTimerRef.current = setTimeout(() => {
        onClick();
        setPending(false);
      }, DELAY_MS);
      return;
    }
    onClick();
  };

  const baseClass = "w-full py-16 border-2 text-lg select-none";
  const stateClass = overloaded
    ? "border-terminal-red bg-terminal-red/10 text-terminal-red cursor-not-allowed"
    : pending
      ? "border-terminal-amber bg-terminal-amber/10 text-terminal-amber cursor-wait"
      : "border-terminal-green text-terminal-green hover:bg-terminal-green/5 active:bg-terminal-green/20 active:scale-[0.98]";

  // Smooth transition for drift; instant for normal/delay
  const transitionClass =
    behavior === "drift" ? "transition-transform duration-300 ease-out" : "transition-all";

  const transformStyle =
    behavior === "drift"
      ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
      : undefined;

  let displayLabel = label;
  if (overloaded) displayLabel = overloadedLabel;
  else if (pending) displayLabel = "▣ PROCESSING...";

  return (
    <button
      onClick={handlePress}
      disabled={disabled || pending}
      style={transformStyle}
      className={`${baseClass} ${stateClass} ${transitionClass}`}
      // v4 (2026-05-22): /mine handles its own tick/error/warning SFX
      // per click — suppress the GlobalClickSfx so we don't double up.
      data-no-sfx
    >
      {displayLabel}
    </button>
  );
}
