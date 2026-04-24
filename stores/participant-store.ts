import { create } from "zustand";
import type { ParticipantStatus, Verdict, BenchmarkScores } from "@/types";

interface ParticipantState {
  // Identity
  id: string | null;
  sessionId: string | null;
  displayId: string;
  authUserId: string | null;

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

  // Mining
  miningCredits: number;
  miningMode: "MANUAL" | "AI_ASSISTED";

  // Leisure
  leisureCredits: number;
  engagementPoints: number;
  backendUnlocked: boolean;

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
  setStatus: (status: ParticipantStatus) => void;
  setScores: (scores: BenchmarkScores) => void;
  setVerdict: (verdict: Verdict) => void;
  addCalibrationAnswer: (answer: ParticipantState["calibrationAnswers"][0]) => void;
  incrementMiningCredits: (amount: number) => void;
  setMiningMode: (mode: "MANUAL" | "AI_ASSISTED") => void;
  addEngagementPoints: (points: number) => void;
  unlockBackend: () => void;
  reset: () => void;
}

const initialState = {
  id: null,
  sessionId: null,
  displayId: "",
  authUserId: null,
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
  miningCredits: 0,
  miningMode: "MANUAL" as const,
  leisureCredits: 150,
  engagementPoints: 0,
  backendUnlocked: false,
  calibrationAnswers: [],
};

export const useParticipantStore = create<ParticipantState>((set) => ({
  ...initialState,

  setParticipant: (data) => set((state) => ({ ...state, ...data })),
  setStatus: (status) => set({ status }),
  setScores: (scores) => set({ scores, operatorEligible: scores.operator_eligible }),
  setVerdict: (verdict) => set({ verdict }),
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
  unlockBackend: () => set({ backendUnlocked: true }),
  reset: () => set(initialState),
}));
