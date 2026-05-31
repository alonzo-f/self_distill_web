"use client";

// v4 entry page — PSA video gate.
// Reference: docs/v4-migration-plan.md Phase 1; 项目方案_v4.md III. 阶段 1
//
// Flow:
//   1. Returning user (persisted phase ≠ UNREGISTERED) → forward to wherever
//      they left off. PSA does NOT replay for returning users.
//   2. Fresh visitor → render <PSAPlayer videoSrc="/psa.mp4" ...>.
//      Player handles autoplay (muted, mobile-safe), 60s hard timeout,
//      Skip button, tap-to-skip, fallback placeholder on autoplay block.
//   3. On PSAPlayer.onComplete → stamp phase=PSA_VIEWED in localStorage
//      and push("/register").

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useParticipantStore } from "@/stores/participant-store";
import {
  loadSession,
  createSession,
  saveSession,
  advancePhase,
} from "@/lib/local-storage";
import { PHASE_TO_ROUTE } from "@/lib/state-machine";
import { PSAPlayer } from "@/components/PSAPlayer";

type Stage = "checking" | "psa" | "advancing";

export default function LandingPage() {
  const router = useRouter();
  const store = useParticipantStore();
  const [stage, setStage] = useState<Stage>("checking");

  // Step 1: figure out whether this is a returning user or a fresh visitor.
  useEffect(() => {
    console.info("[/] mount; routing user");
    const persisted = loadSession();

    if (persisted) {
      store.setParticipant({
        id: persisted.userId,
        displayId: persisted.displayId,
        displayName: persisted.displayName,
        phoneLast4: persisted.phoneLast4,
        phase: persisted.phase,
      });
      // Forward to wherever the user left off — skip PSA on return visits.
      if (persisted.phase !== "UNREGISTERED") {
        const route = PHASE_TO_ROUTE[persisted.phase];
        console.info(`[/] persisted phase=${persisted.phase} → ${route}`);
        router.replace(route);
        return;
      }
    }

    // Fresh visitor — play the PSA. The session row will be stamped to
    // PSA_VIEWED only after the player completes (so re-mount during PSA
    // doesn't skip it).
    // External-system sync: localStorage → state, one-shot on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage("psa");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2: after PSA ends (video end / 60s timeout / Skip / tap),
  // persist PSA_VIEWED and forward to /register.
  const handlePsaComplete = () => {
    if (stage === "advancing") return;
    setStage("advancing");

    const persisted = loadSession();
    const base =
      persisted ??
      createSession({
        userId: crypto.randomUUID(),
        displayId: "",
        displayName: "",
        phoneLast4: null,
      });
    saveSession(advancePhase(base, "PSA_VIEWED"));
    store.setPhase("PSA_VIEWED");
    router.replace("/register");
  };

  if (stage === "psa") {
    return <PSAPlayer videoSrc="/psa.mp4" onComplete={handlePsaComplete} />;
  }

  // "checking" (returning-user redirect in flight) or "advancing"
  // (PSA done, /register navigation in flight) — keep the screen black
  // so the transition is clean.
  return (
    <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
      <div className="text-terminal-dim text-xs font-mono animate-pulse">
        Initializing Expression Optimization Service...
      </div>
    </div>
  );
}
