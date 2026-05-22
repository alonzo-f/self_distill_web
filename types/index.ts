export type ParticipantStatus = "UNPROCESSED" | "CALIBRATING" | "EXPRESSING" | "DISTILLING" | "BENCHMARKED" | "MINING" | "OPERATING" | "LEISURE" | "ARCHIVED";
export type Verdict = "DISTILLED" | "VESSEL_PRESERVED";
export type OperatorActionType = "FLAG" | "THROTTLE" | "BOOST" | "REPORT";
export type SessionPhase = "WAITING" | "ONBOARDING" | "CALIBRATION" | "EXPRESSION" | "PROCESSING" | "REVEAL" | "MINING" | "EVOLUTION" | "COMPLETED";

// v4: user lifecycle phase (state machine driven, separate from ParticipantStatus)
export type UserPhase =
  | "UNREGISTERED"
  | "PSA_VIEWED"
  | "REGISTERED"
  | "CALIBRATED"
  | "EXPRESSED"
  | "DISTILLED_VIEWED"
  | "BENCHMARKED"
  | "HUB_UNLOCKED"
  | "GHOST"
  | "BACKDOOR_FOUND";

// v4: rating tier from benchmark game (drives mining penalty)
export type RatingTier = "10" | "8-9" | "6-7" | "4-5" | "1-3";

// v4: assigned leisure game (compliance-based)
export type LeisureGame = "GUESS" | "BLACKJACK" | "SLOTS";

// v4: backdoor attack types
export type BackdoorAttackType = "SIPHON" | "CORRUPT" | "SWAP";

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
  display_name: string | null;          // v4: 用户提交的昵称 (仅坟场/地基/邮件可见)
  phase: UserPhase;                      // v4: 状态机当前位置
  phone_last4: string | null;            // v4: 跨设备重入凭据
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
  user_rating_tier: RatingTier | null;   // v4: 评分博弈五档
  tier_click_multiplier: number;         // v4: 隐性挖矿惩罚
  tier_error_rate_factor: number;        // v4: 隐性出错率惩罚
  mining_credits: number;
  leisure_credits: number;
  leisure_game: LeisureGame | null;      // v4: 分配的休闲游戏
  engagement_points: number;
  backend_unlocked: boolean;
  attack_tokens: number;                 // v4: 后门攻击 token (0-3)
  archived_at: string | null;            // v4: 转入坟场的时间戳
  is_permanent: boolean;                 // v4: Builder 永久地基条目标记
  is_builder: boolean;
  builder_role: string | null;
  created_at: string;
  updated_at: string;
}

// v4: backdoor attack record (table: backdoor_attacks)
export interface BackdoorAttack {
  id: string;
  attacker_id: string;
  target_id: string;
  action_type: BackdoorAttackType;
  amount: number;
  created_at: string;
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
  /**
   * v4 (2026-05-22): The pre-written "ideal AI answer" for this HR question
   * (≤50 words, optimized for clarity & efficiency). Shown on /distill as the
   * optimized output for the user to rate on /benchmark.
   */
  referenceAnswer: string;
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
