// v4 cumulative leisure stats (persisted across the three games).
// Reference: docs/v4-migration-plan.md Phase 6; project_v4 III. 阶段 6.5c
//
// Lives outside Zustand because it persists across page mounts even when the
// store re-hydrates partial state on reload.

const KEY = "self-distill:leisure-stats";

export interface LeisureStats {
  game: string | null;
  totalWagered: number;
  totalEarned: number;       // gross gains across all bets (i.e. payout sum on wins)
  totalLost: number;         // gross losses across all bets
  betCount: number;
  startedAt: number;
}

const EMPTY: LeisureStats = {
  game: null,
  totalWagered: 0,
  totalEarned: 0,
  totalLost: 0,
  betCount: 0,
  startedAt: 0,
};

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadLeisureStats(): LeisureStats {
  if (!hasStorage()) return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as LeisureStats;
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

export function saveLeisureStats(stats: LeisureStats): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* no-op */
  }
}

export function clearLeisureStats(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}

export function recordBet(
  prev: LeisureStats,
  args: {
    game: string;
    wager: number;
    outcomeDelta: number; // positive on win, negative on loss
  },
): LeisureStats {
  const next: LeisureStats = {
    game: args.game,
    totalWagered: prev.totalWagered + args.wager,
    totalEarned: prev.totalEarned + (args.outcomeDelta > 0 ? args.outcomeDelta : 0),
    totalLost: prev.totalLost + (args.outcomeDelta < 0 ? -args.outcomeDelta : 0),
    betCount: prev.betCount + 1,
    startedAt: prev.startedAt || Date.now(),
  };
  saveLeisureStats(next);
  return next;
}
