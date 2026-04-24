export interface WallScores {
  clarity_score: number;
  efficiency_score: number;
  emotional_noise_score: number;
  compliance_score: number;
}

export interface WallParticipant {
  id: string;
  displayId: string;
  status: string;
  verdict: string | null;
  output: number;
  isOperator: boolean;
  joinedAt: number;
  lastSeenAt: number;
  photoUrl?: string | null;
  scores?: WallScores;
}

export type ParticipantUpsert = Partial<WallParticipant> & {
  id: string;
  displayId: string;
};
