"use client";

// v4 client-side route guard.
// Reference: docs/v4-migration-plan.md Phase 3; project_v4 III. 阶段 0.5
//
// Wraps each linear-flow page. On mount it:
//   1. Reads the persisted session from localStorage.
//   2. Classifies the requested route via classifyRoute() in lib/state-machine.
//   3. Either:
//      - renders children unchanged ("allow"), or
//      - replaces children with <ReadOnlyOverlay> ("readOnly"), or
//      - router.replace()s to the correct route ("redirect").
//
// The guard runs entirely client-side. No middleware required, no cookie sync.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadSession } from "@/lib/local-storage";
import { classifyRoute, type RouteAccess } from "@/lib/state-machine";
import { ReadOnlyOverlay } from "@/components/ReadOnlyOverlay";

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

export function RouteGuard({ children, bypass = false }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>(
    bypass ? { kind: "allow" } : { kind: "checking" },
  );

  useEffect(() => {
    if (bypass) return;
    const session = loadSession();
    const phase = session?.phase ?? "UNREGISTERED";

    const access: RouteAccess = classifyRoute(phase, pathname);

    // External-system sync: localStorage → React state. The setState calls
    // here only fire once per pathname change (and immediately trigger a
    // router transition in the redirect case), so they don't cascade.
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
  }, [bypass, pathname, router]);

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
