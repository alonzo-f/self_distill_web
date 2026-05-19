// v4 participant store
// Reference: docs/v4-migration-plan.md Phase 0
// Maps to v4 doc fields throughout III.
import { create } from "zustand";
import type {
  ParticipantStatus,
  Verdict,
  BenchmarkScores,
  UserPhase,
  RatingTier,
  LeisureGame,
} from "@/types";

interface ParticipantState {
  // Identity
  id: string | null;
  sessionId: string | null;
  displayId: string;
  displayName: string;           // v4: 用户提交的昵称
  phoneLast4: string | null;     // v4: 跨设备重入凭据
  authUserId: string | null;

  // v4 state machine
  phase: UserPhase;

  // Media
  photoUrl: string | null;
  avatarUrl: string | null;
  photoBlob: Blob | null;

  // Status
  status: ParticipantStatus;
  verdict: Verdict | null;

  // Expression
  originalText: string | null;
  distilledText: string | null;

  // Scores
  scores: BenchmarkScores | null;
  operatorEligible: boolean;
  userRatingOfAi: number | null;

  // v4: rating tier from benchmark game
  userRatingTier: RatingTier | null;
  tierClickMultiplier: number;     // default 1.0
  tierErrorRateFactor: number;     // default 1.0

  // Mining
  miningCredits: number;
  miningMode: "MANUAL" | "AI_ASSISTED";

  // Leisure
  leisureCredits: number;
  leisureGame: LeisureGame | null; // v4: 分配的休闲游戏
  engagementPoints: number;
  backendUnlocked: boolean;

  // v4: backdoor + archive
  attackTokens: number;
  archivedAt: number | null;
  isPermanent: boolean;

  // Calibration results (stored locally before submission)
  calibrationAnswers: {
    questionKey: string;
    selectedOption: string;
    responseTimeMs: number;
    changedAnswer: boolean;
    changeCount: number;
  }[];

  // Actions
  setParticipant: (data: Partial<ParticipantState>) => void;
  setPhase: (phase: UserPhase) => void;
  setStatus: (status: ParticipantStatus) => void;
  setScores: (scores: BenchmarkScores) => void;
  setVerdict: (verdict: Verdict) => void;
  setRatingTier: (tier: RatingTier, clickMultiplier: number, errorRateFactor: number) => void;
  setLeisureGame: (game: LeisureGame) => void;
  addCalibrationAnswer: (answer: ParticipantState["calibrationAnswers"][0]) => void;
  incrementMiningCredits: (amount: number) => void;
  setMiningMode: (mode: "MANUAL" | "AI_ASSISTED") => void;
  addEngagementPoints: (points: number) => void;
  unlockBackend: () => void;
  spendAttackToken: () => boolean;
  archive: () => void;
  reset: () => void;
}

const initialState = {
  id: null,
  sessionId: null,
  displayId: "",
  displayName: "",
  phoneLast4: null,
  authUserId: null,
  phase: "UNREGISTERED" as UserPhase,
  photoUrl: null,
  avatarUrl: null,
  photoBlob: null,
  status: "UNPROCESSED" as ParticipantStatus,
  verdict: null,
  originalText: null,
  distilledText: null,
  scores: null,
  operatorEligible: false,
  userRatingOfAi: null,
  userRatingTier: null,
  tierClickMultiplier: 1.0,
  tierErrorRateFactor: 1.0,
  miningCredits: 0,
  miningMode: "MANUAL" as const,
  leisureCredits: 0,           // v4: credit = 实际挖矿点击数, 初始为 0
  leisureGame: null,
  engagementPoints: 0,
  backendUnlocked: false,
  attackTokens: 0,
  archivedAt: null,
  isPermanent: false,
  calibrationAnswers: [],
};

export const useParticipantStore = create<ParticipantState>((set, get) => ({
  ...initialState,

  setParticipant: (data) => set((state) => ({ ...state, ...data })),

  setPhase: (phase) => set({ phase }),

  setStatus: (status) => set({ status }),

  setScores: (scores) => set({ scores, operatorEligible: scores.operator_eligible }),

  setVerdict: (verdict) => set({ verdict }),

  setRatingTier: (tier, clickMultiplier, errorRateFactor) =>
    set({
      userRatingTier: tier,
      tierClickMultiplier: clickMultiplier,
      tierErrorRateFactor: errorRateFactor,
    }),

  setLeisureGame: (game) => set({ leisureGame: game }),

  addCalibrationAnswer: (answer) =>
    set((state) => ({
      calibrationAnswers: [...state.calibrationAnswers, answer],
    })),

  incrementMiningCredits: (amount) =>
    set((state) => ({ miningCredits: state.miningCredits + amount })),

  setMiningMode: (mode) => set({ miningMode: mode }),

  addEngagementPoints: (points) =>
    set((state) => ({
      engagementPoints: Math.min(100, state.engagementPoints + points),
    })),

  unlockBackend: () =>
    set((state) => ({
      backendUnlocked: true,
      // v4: backdoor 解锁自动获 3 个 attack token
      attackTokens: state.attackTokens || 3,
    })),

  spendAttackToken: () => {
    const current = get().attackTokens;
    if (current <= 0) return false;
    set({ attackTokens: current - 1 });
    return true;
  },

  archive: () =>
    set({
      phase: "GHOST" as UserPhase,
      status: "ARCHIVED",
      archivedAt: Date.now(),
    }),

  reset: () => set(initialState),
}));
