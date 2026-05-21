"use client";

// v4 entry page — plays the PSA, then advances to /register.
// Reference: docs/v4-migration-plan.md Phase 1; project_v4 III. 背景故事
// Previous welcome/terms/photo logic moved to /register.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PSAPlayer } from "@/components/PSAPlayer";
import { useParticipantStore } from "@/stores/participant-store";
import {
  loadSession,
  createSession,
  saveSession,
  advancePhase,
} from "@/lib/local-storage";
import { PHASE_TO_ROUTE } from "@/lib/state-machine";

const PSA_VIDEO_SRC = "/psa.mp4"; // empty until阶段 11; player handles missing file

export default function LandingPage() {
  const router = useRouter();
  const store = useParticipantStore();

  // Re-entry guard: if user already has a session, route them to wherever they left off.
  useEffect(() => {
    console.info("[/] mount; checking session");
    const persisted = loadSession();
    if (!persisted) {
      console.info("[/] no persisted session — will play PSA");
      return;
    }

    // Rehydrate Zustand from localStorage.
    store.setParticipant({
      id: persisted.userId,
      displayId: persisted.displayId,
      displayName: persisted.displayName,
      phoneLast4: persisted.phoneLast4,
      phase: persisted.phase,
    });

    // If user already moved past PSA, jump them forward.
    if (persisted.phase !== "UNREGISTERED") {
      console.info(`[/] already past PSA (phase=${persisted.phase}) → replace to ${PHASE_TO_ROUTE[persisted.phase]}`);
      router.replace(PHASE_TO_ROUTE[persisted.phase]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePsaComplete = () => {
    console.info("[/] PSA complete → advancing to PSA_VIEWED + pushing /register");
    // Persist PSA_VIEWED so we won't re-show the PSA on refresh
    const existing = loadSession();
    if (existing) {
      saveSession(advancePhase(existing, "PSA_VIEWED"));
    } else {
      // First-time visitor — create a stub session (userId is set later in /register).
      const tempId = crypto.randomUUID();
      saveSession(advancePhase(createSession({
        userId: tempId,
        displayId: "",
        displayName: "",
        phoneLast4: null,
      }), "PSA_VIEWED"));
    }
    store.setPhase("PSA_VIEWED");
    router.push("/register");
  };

  return (
    <>
      <PSAPlayer videoSrc={PSA_VIDEO_SRC} onComplete={handlePsaComplete} />
      <DebugBar />
    </>
  );
}

/**
 * Visible debug strip on the PSA page only.
 * Shows the current phase + a [Reset Session] button so the user can
 * manually unstick themselves during local testing. Removed before演出.
 */
function DebugBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex justify-between items-center text-[10px] font-mono text-terminal-dim/80 px-3 py-1 bg-black/40 backdrop-blur-sm pointer-events-auto"
      style={{ paddingTop: "max(env(safe-area-inset-top), 4px)" }}
    >
      <span>self-distill · dev</span>
      <button
        onClick={() => {
          try {
            window.localStorage.clear();
          } catch {
            /* ignore */
          }
          window.location.reload();
        }}
        className="border border-terminal-amber/60 text-terminal-amber px-2 py-0.5 hover:bg-terminal-amber/10"
      >
        Reset Session
      </button>
    </div>
  );
}
