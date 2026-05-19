"use client";

// v4 [← Hub] button for non-linear pages.
// Reference: docs/v4-migration-plan.md Phase 3; project_v4 III. 阶段 0.5
//
// Renders only after the user has unlocked the Hub (phase >= BENCHMARKED).
// Position is fixed top-right; small + low-contrast so it doesn't compete
// with the page's primary affordance.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "@/lib/local-storage";
import { isHubUnlocked } from "@/lib/state-machine";

export function HubButton() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const s = loadSession();
    // External-system sync: localStorage → React. The setState here only
    // fires once on mount and never reactively, so it's safe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s && isHubUnlocked(s.phase)) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => router.push("/hub")}
      className="fixed top-3 right-3 z-40 border border-terminal-dim text-terminal-dim font-mono text-[11px] px-2.5 py-1 hover:text-terminal-green hover:border-terminal-green transition-colors"
    >
      ← Hub
    </button>
  );
}
