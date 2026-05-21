"use client";

// v4 client-side route guard.
// Reference: docs/v4-migration-plan.md Phase 3; project_v4 III. 阶段 0.5
//
// Wraps each linear-flow page. On mount it:
//   1. Reads the persisted session from localStorage.
//   2. Falls back to the in-memory Zustand store.phase if localStorage is
//      missing or stuck behind — guards against silent localStorage write
//      failures (private mode, some mobile browsers) that otherwise cause
//      infinite redirect loops back to "/".
//   3. Classifies the requested route via classifyRoute() in lib/state-machine.
//   4. Either:
//      - renders children unchanged ("allow"), or
//      - replaces children with <ReadOnlyOverlay> ("readOnly"), or
//      - router.replace()s to the correct route ("redirect").

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  loadSession,
  saveSession,
  createSession,
  advancePhase,
} from "@/lib/local-storage";
import {
  classifyRoute,
  PHASE_ORDER,
  type RouteAccess,
} from "@/lib/state-machine";
import { ReadOnlyOverlay } from "@/components/ReadOnlyOverlay";
import { useParticipantStore } from "@/stores/participant-store";
import type { UserPhase } from "@/types";

interface RouteGuardProps {
  children: React.ReactNode;
  /** When true, guard does nothing — used by /hub itself, /wall, etc. */
  bypass?: boolean;
}

type GuardState =
  | { kind: "checking" }
  | { kind: "allow" }
  | { kind: "readOnly"; allowedRoute: string }
  | { kind: "redirecting"; to: string };

/** Return whichever phase is further along in the linear progression. */
function maxPhase(a: UserPhase, b: UserPhase): UserPhase {
  // Terminal phases (GHOST, BACKDOOR_FOUND) don't have a clean order; keep
  // whichever the caller had more locally.
  const ai = PHASE_ORDER.indexOf(a);
  const bi = PHASE_ORDER.indexOf(b);
  if (ai < 0) return a === "UNREGISTERED" ? b : a;
  if (bi < 0) return b === "UNREGISTERED" ? a : b;
  return ai >= bi ? a : b;
}

export function RouteGuard({ children, bypass = false }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const storePhase = useParticipantStore((s) => s.phase);
  const storeId = useParticipantStore((s) => s.id);
  const storeDisplayId = useParticipantStore((s) => s.displayId);

  const [state, setState] = useState<GuardState>(
    bypass ? { kind: "allow" } : { kind: "checking" },
  );

  useEffect(() => {
    if (bypass) return;

    // Read both sources, pick whichever is further along.
    const session = loadSession();
    const persistedPhase = session?.phase ?? "UNREGISTERED";
    const phase = maxPhase(persistedPhase, storePhase);

    // If Zustand is ahead of localStorage, write Zustand back to localStorage
    // so subsequent pages see the consistent state. This self-heals when
    // localStorage was failing silently earlier in the flow.
    if (phase !== persistedPhase && phase !== "UNREGISTERED") {
      const base =
        session ??
        createSession({
          userId: storeId ?? crypto.randomUUID(),
          displayId: storeDisplayId ?? "",
          displayName: "",
          phoneLast4: null,
        });
      saveSession(advancePhase(base, phase));
    }

    const access: RouteAccess = classifyRoute(phase, pathname);

    /* eslint-disable react-hooks/set-state-in-effect */
    if (access.kind === "redirect") {
      setState({ kind: "redirecting", to: access.to });
      router.replace(access.to);
      return;
    }
    if (access.kind === "readOnly") {
      setState({ kind: "readOnly", allowedRoute: access.allowedRoute });
      return;
    }
    setState({ kind: "allow" });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [bypass, pathname, router, storePhase, storeId, storeDisplayId]);

  if (state.kind === "checking" || state.kind === "redirecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
        <div className="text-terminal-dim text-xs font-mono animate-pulse">
          {state.kind === "redirecting"
            ? `Routing to ${state.to}...`
            : "Verifying session..."}
        </div>
      </div>
    );
  }

  if (state.kind === "readOnly") {
    return <ReadOnlyOverlay pathname={pathname} allowedRoute={state.allowedRoute} />;
  }

  return <>{children}</>;
}
