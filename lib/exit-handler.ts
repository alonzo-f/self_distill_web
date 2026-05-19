// v4 exit + start-over flow
// Reference: docs/v4-migration-plan.md Phase 3; project_v4 III. 阶段 0.5
//
// Two operations:
//
//   exitToHub()   — preserve every completed-stage datum, send user to /hub.
//                   No DB delete. Implements "前一页保留" rule for the active
//                   page (i.e. caller already ensured nothing was written from
//                   the current uncompleted step).
//
//   startOver()   — only allowed for HUB_UNLOCKED+ or GHOST phases.
//                   GDPR hard-delete: DELETE the participant row, clear
//                   localStorage, send back to PSA entry.

import { clearSession, loadSession } from "@/lib/local-storage";
import { canStartOver } from "@/lib/state-machine";

/** Navigate to Hub, preserving all data. Caller is responsible for `router`. */
export function exitToHub(router: { push: (path: string) => void }): void {
  router.push("/hub");
}

interface StartOverResult {
  ok: boolean;
  reason?: "not-allowed" | "no-session" | "api-error";
}

/**
 * Wipe the user from both client (localStorage + Zustand) and server (DB).
 * Returns ok=false (with reason) when the caller's phase isn't eligible.
 *
 * Caller must:
 * - call this *after* user confirms the dark-pattern modal
 * - reset the Zustand store (zustand state isn't owned here)
 * - navigate to "/" on success
 */
export async function startOver(): Promise<StartOverResult> {
  const persisted = loadSession();
  if (!persisted) return { ok: false, reason: "no-session" };
  if (!canStartOver(persisted.phase)) return { ok: false, reason: "not-allowed" };

  try {
    const res = await fetch(`/api/participants/${persisted.userId}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) {
      return { ok: false, reason: "api-error" };
    }
  } catch (err) {
    console.error("startOver: DELETE failed", err);
    return { ok: false, reason: "api-error" };
  }

  clearSession();
  return { ok: true };
}
