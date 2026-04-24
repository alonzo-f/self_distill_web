export type ParticipantStatus = "UNPROCESSED" | "CALIBRATING" | "EXPRESSING" | "DISTILLING" | "BENCHMARKED" | "MINING" | "OPERATING" | "LEISURE" | "ARCHIVED";
export type Verdict = "DISTILLED" | "VESSEL_PRESERVED";
export type OperatorActionType = "FLAG" | "THROTTLE" | "BOOST" | "REPORT";
export type SessionPhase = "WAITING" | "ONBOARDING" | "CALIBRATION" | "EXPRESSION" | "PROCESSING" | "REVEAL" | "MINING" | "EVOLUTION" | "COMPLETED";

export interface BenchmarkScores {
  clarity: number;
  efficiency: number;
  emotional_noise: number;
  compliance: number;
  assessment: string;
  operator_eligible: boolean;
}

export interface MiningParams {
  miningStability: number;
  clickMultiplier: number;
  errorRate: number;
  operatorEligible: boolean;
}

export interface TypingEvent {
  type: "keydown" | "pause" | "delete" | "paste";
  timestamp: number;
  data?: string;
}

export interface TypingMetrics {
  totalDurationSec: number;
  pauseCount: number;
  deletionCount: number;
  wordCount: number;
  charCount: number;
}

export interface LeaderboardEntry {
  participant_id: string;
  display_id: string;
  total_output: number;
  mode: "MANUAL" | "AI_ASSISTED";
  verdict: Verdict;
  is_operator: boolean;
}

export interface Participant {
  id: string;
  session_id: string;
  display_id: string;
  photo_url: string | null;
  avatar_url: string | null;
  status: ParticipantStatus;
  verdict: Verdict | null;
  original_text: string | null;
  distilled_text: string | null;
  clarity_score: number | null;
  efficiency_score: number | null;
  emotional_noise_score: number | null;
  compliance_score: number | null;
  ai_assessment: string | null;
  operator_eligible: boolean;
  user_rating_of_ai: number | null;
  mining_credits: number;
  leisure_credits: number;
  engagement_points: number;
  backend_unlocked: boolean;
  is_builder: boolean;
  builder_role: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalibrationQuestion {
  key: string;
  disguise: string;
  dimension: string;
  question: string;
  options: { label: string; value: string }[];
  timeLimit: number;
}

export interface ExpressionPrompt {
  key: string;
  text: string;
  timeLimit: number;
}

// AI Provider abstraction
export interface AIProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface DistillRequest {
  promptText: string;
  userInput: string;
}

export interface DistillResponse {
  distilledText: string;
}

export interface BenchmarkRequest {
  promptText: string;
  userInput: string;
  inputDurationSec: number;
  pauseCount: number;
  deletionCount: number;
  wordCount: number;
  calibrationResults: {
    questionKey: string;
    selectedOption: string;
    responseTimeMs: number;
    changedAnswer: boolean;
  }[];
}
