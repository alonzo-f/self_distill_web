// v4 client-side session persistence
// Reference: docs/v4-migration-plan.md Phase 0, Phase 3
// Maps to v4 doc: III. 阶段 0.5 (重入机制) + Exit 行为规范

import type {
  UserPhase,
  RatingTier,
  BenchmarkScores,
  TypingMetrics,
} from "@/types";

const STORAGE_KEY = "self-distill:session";
const STORAGE_VERSION = 1;

export interface CalibrationSnapshot {
  questionKey: string;
  selectedOption: string;
  responseTimeMs: number;
  changedAnswer: boolean;
  changeCount: number;
}

export interface ExpressionSnapshot {
  promptKey: string;
  promptText: string;
  userInput: string;
  metrics: TypingMetrics;
}

export interface DistillationSnapshot {
  distilledText: string;
}

export interface BenchmarkSnapshot {
  rating: number;
  tier: RatingTier;
  scores: BenchmarkScores;
  retried: boolean;
}

/**
 * Frozen snapshot of every completed stage.
 * Used to populate read-only views when a user re-enters mid-flow.
 * Once a stage is written here, it is treated as IMMUTABLE per the
 * v4 "前一页保留" Exit rule — you cannot edit what the system already heard.
 */
export interface StageSnapshots {
  calibration?: CalibrationSnapshot[];
  expression?: ExpressionSnapshot;
  distillation?: DistillationSnapshot;
  benchmark?: BenchmarkSnapshot;
}

export interface PersistedSession {
  version: number;
  userId: string;            // UUID (matches participants.id)
  displayId: string;         // HUMAN_XXX
  displayName: string;       // @ Nickname
  phoneLast4: string | null;
  phase: UserPhase;
  createdAt: number;
  updatedAt: number;
  snapshots: StageSnapshots;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Load the persisted session, or null if none exists / corrupt. */
export function loadSession(): PersistedSession | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      console.info("[session] load: no entry");
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedSession;
    if (parsed.version !== STORAGE_VERSION) {
      console.warn(
        `[session] load: version mismatch (${parsed.version} vs ${STORAGE_VERSION}), discarding`,
      );
      return null;
    }
    console.info("[session] load:", { phase: parsed.phase, displayId: parsed.displayId });
    return parsed;
  } catch (err) {
    console.warn("[session] load: parse failed", err);
    return null;
  }
}

/** Persist (or update) the session. Caller is responsible for setting `updatedAt`. */
export function saveSession(session: PersistedSession): void {
  if (!hasStorage()) {
    console.warn("[session] save: window.localStorage unavailable");
    return;
  }
  try {
    const payload: PersistedSession = {
      ...session,
      version: STORAGE_VERSION,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    console.info("[session] save:", { phase: payload.phase });
  } catch (err) {
    console.warn("[session] save: WRITE FAILED — flow will rely on Zustand only", err);
  }
}

/** Clear the session entirely (used by Start Over / GDPR delete). */
export function clearSession(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

/** Convenience: create a fresh session record. */
export function createSession(input: {
  userId: string;
  displayId: string;
  displayName?: string;
  phoneLast4?: string | null;
}): PersistedSession {
  const now = Date.now();
  return {
    version: STORAGE_VERSION,
    userId: input.userId,
    displayId: input.displayId,
    displayName: input.displayName ?? "",
    phoneLast4: input.phoneLast4 ?? null,
    phase: "UNREGISTERED",
    createdAt: now,
    updatedAt: now,
    snapshots: {},
  };
}

/** Update the phase, returning a new session record. */
export function advancePhase(
  session: PersistedSession,
  nextPhase: UserPhase,
): PersistedSession {
  return {
    ...session,
    phase: nextPhase,
    updatedAt: Date.now(),
  };
}

/** Merge a stage snapshot. v4 rule: snapshots are append-only / immutable. */
export function setSnapshot<K extends keyof StageSnapshots>(
  session: PersistedSession,
  key: K,
  value: StageSnapshots[K],
): PersistedSession {
  // Refuse to overwrite an existing snapshot — the "system never lets you
  // modify what you already said" rule from v4 阶段 0.5.
  if (session.snapshots[key] !== undefined) {
    return session;
  }
  return {
    ...session,
    snapshots: { ...session.snapshots, [key]: value },
    updatedAt: Date.now(),
  };
}
