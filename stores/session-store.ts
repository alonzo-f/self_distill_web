import { create } from "zustand";
import type { SessionPhase, LeaderboardEntry, OperatorActionType } from "@/types";

interface OperatorAction {
  id: string;
  sourceDisplayId: string;
  targetDisplayId: string;
  actionType: OperatorActionType;
  timestamp: string;
}

interface SessionState {
  sessionId: string | null;
  phase: SessionPhase;

  // Leaderboard
  leaderboard: LeaderboardEntry[];

  // Operator actions log
  operatorActions: OperatorAction[];

  // System stats (for projection wall)
  systemStats: {
    humanProducerPercent: number;
    aiProducerPercent: number;
    leisureCount: number;
    totalParticipants: number;
  };

  // Online participants
  onlineParticipants: string[];

  // Actions
  setSession: (data: Partial<SessionState>) => void;
  setPhase: (phase: SessionPhase) => void;
  updateLeaderboard: (entries: LeaderboardEntry[]) => void;
  addOperatorAction: (action: OperatorAction) => void;
  updateSystemStats: (stats: SessionState["systemStats"]) => void;
  setOnlineParticipants: (ids: string[]) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  phase: "WAITING",
  leaderboard: [],
  operatorActions: [],
  systemStats: {
    humanProducerPercent: 100,
    aiProducerPercent: 0,
    leisureCount: 0,
    totalParticipants: 0,
  },
  onlineParticipants: [],

  setSession: (data) => set((state) => ({ ...state, ...data })),
  setPhase: (phase) => set({ phase }),
  updateLeaderboard: (entries) => set({ leaderboard: entries }),
  addOperatorAction: (action) =>
    set((state) => ({
      operatorActions: [action, ...state.operatorActions].slice(0, 50),
    })),
  updateSystemStats: (stats) => set({ systemStats: stats }),
  setOnlineParticipants: (ids) => set({ onlineParticipants: ids }),
  reset: () =>
    set({
      sessionId: null,
      phase: "WAITING",
      leaderboard: [],
      operatorActions: [],
      systemStats: { humanProducerPercent: 100, aiProducerPercent: 0, leisureCount: 0, totalParticipants: 0 },
      onlineParticipants: [],
    }),
}));
