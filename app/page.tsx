"use client";

// v4 entry page — fast-path straight to /register.
// Reference: docs/v4-migration-plan.md Phase 1
//
// 历史: 这里原来播 PSA 视频, 然后推到 /register. 用户测试反馈期间
// 决定彻底跳过 PSA — 直接进 /register, 把 PSA 留为可选的预演物料.
//
// On mount we:
//   1. Rehydrate any existing session into Zustand
//   2. If user is past PSA, route them to their actual page
//   3. Otherwise stamp phase=PSA_VIEWED in storage + push /register
//
// We still write PSA_VIEWED to localStorage so the downstream gates
// (RouteGuard, /register guard) continue to function unchanged.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useParticipantStore } from "@/stores/participant-store";
import {
  loadSession,
  createSession,
  saveSession,
  advancePhase,
} from "@/lib/local-storage";
import { PHASE_TO_ROUTE } from "@/lib/state-machine";

export default function LandingPage() {
  const router = useRouter();
  const store = useParticipantStore();

  useEffect(() => {
    console.info("[/] mount; routing user");
    const persisted = loadSession();

    // Returning user — rehydrate and forward to wherever they left off.
    if (persisted) {
      store.setParticipant({
        id: persisted.userId,
        displayId: persisted.displayId,
        displayName: persisted.displayName,
        phoneLast4: persisted.phoneLast4,
        phase: persisted.phase,
      });
      if (persisted.phase !== "UNREGISTERED") {
        const route = PHASE_TO_ROUTE[persisted.phase];
        console.info(`[/] persisted phase=${persisted.phase} → ${route}`);
        router.replace(route);
        return;
      }
    }

    // First-time visitor: stamp PSA_VIEWED (since PSA is skipped) + push /register.
    console.info("[/] fresh visitor — skipping PSA, going to /register");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Brief loading view while the redirect runs.
  return (
    <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
      <div className="text-terminal-dim text-xs font-mono animate-pulse">
        Initializing Expression Optimization Service...
      </div>
      <DebugBar />
    </div>
  );
}

/**
 * Reset button kept at top-right for testing. Removed before演出.
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
