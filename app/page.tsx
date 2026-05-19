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
    const persisted = loadSession();
    if (!persisted) return;

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
      router.replace(PHASE_TO_ROUTE[persisted.phase]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePsaComplete = () => {
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

  return <PSAPlayer videoSrc={PSA_VIDEO_SRC} onComplete={handlePsaComplete} />;
}
