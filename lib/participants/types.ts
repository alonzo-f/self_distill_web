// v4 wall-facing participant shape.
// Reference: docs/v4-migration-plan.md Phase 0, Phase 8
import type {
  UserPhase,
  RatingTier,
  LeisureGame,
} from "@/types";

export interface WallScores {
  clarity_score: number;
  efficiency_score: number;
  emotional_noise_score: number;
  compliance_score: number;
}

export interface WallParticipant {
  id: string;
  displayId: string;
  displayName: string | null;       // v4: 仅在坟场/公告喜剧事件中显示
  phase: UserPhase;                  // v4: 状态机当前位置
  status: string;
  verdict: string | null;
  output: number;
  isOperator: boolean;
  joinedAt: number;
  lastSeenAt: number;
  photoUrl?: string | null;
  scores?: WallScores;

  // v4 additions
  userRatingTier?: RatingTier | null;
  tierClickMultiplier?: number;
  tierErrorRateFactor?: number;
  leisureGame?: LeisureGame | null;
  attackTokens?: number;
  archivedAt?: number | null;
  isPermanent?: boolean;             // v4: Builder 永久地基条目
  isBuilder?: boolean;
  builderRole?: string | null;
  engagementPoints?: number;
  backendUnlocked?: boolean;

  // v4 (2026-05-22): user-supplied email for post-experience SMS follow-up.
  email?: string | null;

  // v4 (2026-05-22, 修改0519.md item 4): cached so the digital passport
  // can render the user's original answer and the AI-distilled output.
  // Server side only — wall UI doesn't display these.
  originalText?: string | null;
  distilledText?: string | null;
}

export type ParticipantUpsert = Partial<WallParticipant> & {
  id: string;
  displayId: string;
};

// v4: graveyard board (D 板块) entry shape
export interface GraveyardEntry {
  displayName: string;               // 真实昵称, 灰色显示
  archivedAt: string | null;         // null for permanent builders
  isPermanent: boolean;              // BUILDER_01 / BUILDER_02 = true, 金色加粗
}
