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
