// v4 state machine for user lifecycle
// Reference: docs/v4-migration-plan.md Phase 0, Phase 3
// Maps to v4 doc: III. 阶段 0.5 (装置形态——状态机与 Hub 主页)

import type { UserPhase } from "@/types";

/**
 * Single source of truth for phase ordering.
 * Index in this array == ordinal position in the state machine.
 * GHOST / BACKDOOR_FOUND are terminal branches off HUB_UNLOCKED and
 * are intentionally placed at the end (not part of strict ordering).
 */
export const PHASE_ORDER: UserPhase[] = [
  "UNREGISTERED",
  "PSA_VIEWED",
  "REGISTERED",
  "CALIBRATED",
  "EXPRESSED",
  "DISTILLED_VIEWED",
  "BENCHMARKED",
  "HUB_UNLOCKED",
];

/** Terminal/branch phases (not part of linear progression). */
export const TERMINAL_PHASES: UserPhase[] = ["GHOST", "BACKDOOR_FOUND"];

/** Default landing route for each phase. */
export const PHASE_TO_ROUTE: Record<UserPhase, string> = {
  UNREGISTERED: "/",
  PSA_VIEWED: "/register",
  REGISTERED: "/calibrate",
  CALIBRATED: "/task",
  EXPRESSED: "/distill",
  DISTILLED_VIEWED: "/benchmark",
  BENCHMARKED: "/verdict",   // BENCHMARKED → 看 verdict 揭示 → HUB_UNLOCKED
  HUB_UNLOCKED: "/hub",
  GHOST: "/ghost",
  BACKDOOR_FOUND: "/hub",
};

/**
 * The ordered list of route paths that map to each linear phase.
 * Used by the route guard to detect "already completed" pages and
 * apply read-only mode.
 *
 * Indices intentionally line up with PHASE_ORDER:
 *   0 UNREGISTERED      → /
 *   1 PSA_VIEWED        → /register
 *   2 REGISTERED        → /calibrate
 *   3 CALIBRATED        → /task
 *   4 EXPRESSED         → /distill
 *   5 DISTILLED_VIEWED  → /benchmark
 *   6 BENCHMARKED       → /verdict
 *   7 HUB_UNLOCKED      → /hub
 */
export const ROUTE_ORDER: string[] = [
  "/",
  "/register",
  "/calibrate",
  "/task",
  "/distill",
  "/benchmark",
  "/verdict",
  "/hub",
];

/** Pages that should be guarded by the linear state machine. */
export const LINEAR_ROUTES = new Set(ROUTE_ORDER);

/** Pages reachable freely once Hub is unlocked (post-main-line). */
export const FREE_ROUTES = new Set(["/mine", "/leisure", "/wall", "/operate", "/backdoor"]);

/**
 * Stage timeout caps (in milliseconds) — protect against users
 * stalling indefinitely on any single page.
 * Maps to v4 doc III. 阶段 0.5 "阶段时长上限" table.
 */
export const STAGE_TIMEOUTS_MS = {
  PSA: 60_000,
  CALIBRATION_PER_Q: 15_000,
  EXPRESSION: 120_000,
  DISTILL_VIEW: 30_000,
  BENCHMARK: 30_000,
  MINING_ROUND: 60_000,
  LEISURE: Number.POSITIVE_INFINITY,
} as const;

/** Returns true if `target` is a legal phase to transition into from `current`. */
export function canAdvanceTo(current: UserPhase, target: UserPhase): boolean {
  // Terminal branches: allowed from any post-HUB_UNLOCKED state.
  if (TERMINAL_PHASES.includes(target)) {
    return phaseIndex(current) >= phaseIndex("BENCHMARKED");
  }
  // Linear progression: target must be exactly current + 1 (or same).
  const cur = phaseIndex(current);
  const tgt = phaseIndex(target);
  if (cur < 0 || tgt < 0) return false;
  return tgt === cur || tgt === cur + 1;
}

/** Returns ordinal index of phase, or -1 if not in linear progression. */
export function phaseIndex(phase: UserPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

/** True if the user has finished the main path (Hub is unlocked). */
export function isHubUnlocked(phase: UserPhase): boolean {
  return (
    phase === "HUB_UNLOCKED" ||
    phase === "BACKDOOR_FOUND" ||
    phaseIndex(phase) >= phaseIndex("BENCHMARKED")
  );
}

/** True if the user can perform Start Over (delete + restart). */
export function canStartOver(phase: UserPhase): boolean {
  return phase === "GHOST" || isHubUnlocked(phase);
}

/**
 * Given current phase and a requested route, classify how it should
 * be served by the middleware / page guard.
 *
 * - "allow":     user is at the right page or beyond. Render normally.
 * - "redirect":  user tried to skip ahead. Send them to allowed route.
 * - "readOnly":  user revisited an already-completed page. Show snapshot.
 */
export type RouteAccess =
  | { kind: "allow" }
  | { kind: "redirect"; to: string }
  | { kind: "readOnly"; allowedRoute: string };

export function classifyRoute(
  phase: UserPhase,
  requestedPath: string,
): RouteAccess {
  // Terminal Ghost users are locked to /ghost
  if (phase === "GHOST" && requestedPath !== "/ghost") {
    return { kind: "redirect", to: "/ghost" };
  }

  const allowedRoute = PHASE_TO_ROUTE[phase];
  const allowedIdx = ROUTE_ORDER.indexOf(allowedRoute);
  const requestedIdx = ROUTE_ORDER.indexOf(requestedPath);

  // Requested route is not part of the linear flow (e.g. /mine, /leisure)
  // Allow through if user has unlocked the Hub.
  if (requestedIdx === -1) {
    if (isHubUnlocked(phase)) return { kind: "allow" };
    return { kind: "redirect", to: allowedRoute };
  }

  // User is exactly where they're supposed to be.
  if (requestedIdx === allowedIdx) return { kind: "allow" };

  // User tries to skip ahead.
  if (requestedIdx > allowedIdx) {
    return { kind: "redirect", to: allowedRoute };
  }

  // User revisits a completed page — read-only mode.
  return { kind: "readOnly", allowedRoute };
}
