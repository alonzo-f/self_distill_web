import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserPhase } from "@/types";
import type { ParticipantUpsert, WallParticipant, WallScores } from "./types";

// v4: columns we always select for wall/participant queries.
// Kept as a single-line string for Supabase's type-level select parser.
const PARTICIPANT_SELECT =
  "id, display_id, display_name, phase, status, verdict, output, is_operator, joined_at, last_seen_at, photo_url, clarity_score, efficiency_score, emotional_noise_score, compliance_score, user_rating_tier, tier_click_multiplier, tier_error_rate_factor, leisure_game, attack_tokens, archived_at, is_permanent, is_builder, builder_role, engagement_points, backend_unlocked";

const PHOTO_BUCKET = "participant-photos";

declare global {
  var __wallParticipants: Map<string, WallParticipant> | undefined;
}

function getMemoryStore(): Map<string, WallParticipant> {
  if (!global.__wallParticipants) {
    global.__wallParticipants = new Map();
  }
  return global.__wallParticipants;
}

function toIsoMillis(value: string | null | undefined, fallback = Date.now()) {
  return value ? new Date(value).getTime() : fallback;
}

function fromDb(row: Record<string, unknown>): WallParticipant {
  const scores =
    row.clarity_score !== null &&
    row.efficiency_score !== null &&
    row.emotional_noise_score !== null &&
    row.compliance_score !== null &&
    row.clarity_score !== undefined &&
    row.efficiency_score !== undefined &&
    row.emotional_noise_score !== undefined &&
    row.compliance_score !== undefined
      ? ({
          clarity_score: Number(row.clarity_score),
          efficiency_score: Number(row.efficiency_score),
          emotional_noise_score: Number(row.emotional_noise_score),
          compliance_score: Number(row.compliance_score),
        } satisfies WallScores)
      : undefined;

  return {
    id: String(row.id),
    displayId: String(row.display_id),
    displayName: row.display_name ? String(row.display_name) : null,
    phase: (row.phase ? String(row.phase) : "UNREGISTERED") as UserPhase,
    status: String(row.status ?? "MINING"),
    verdict: row.verdict ? String(row.verdict) : null,
    output: Number(row.output ?? 0),
    isOperator: Boolean(row.is_operator),
    joinedAt: toIsoMillis(row.joined_at as string | null | undefined),
    lastSeenAt: toIsoMillis(row.last_seen_at as string | null | undefined),
    photoUrl: rewritePhotoUrl(row.photo_url, String(row.id)),
    scores,
    // v4 additions (optional in WallParticipant)
    userRatingTier: (row.user_rating_tier as WallParticipant["userRatingTier"]) ?? null,
    tierClickMultiplier:
      row.tier_click_multiplier !== undefined && row.tier_click_multiplier !== null
        ? Number(row.tier_click_multiplier)
        : 1.0,
    tierErrorRateFactor:
      row.tier_error_rate_factor !== undefined && row.tier_error_rate_factor !== null
        ? Number(row.tier_error_rate_factor)
        : 1.0,
    leisureGame: (row.leisure_game as WallParticipant["leisureGame"]) ?? null,
    attackTokens: Number(row.attack_tokens ?? 0),
    archivedAt:
      row.archived_at !== undefined && row.archived_at !== null
        ? toIsoMillis(row.archived_at as string)
        : null,
    isPermanent: Boolean(row.is_permanent),
    isBuilder: Boolean(row.is_builder),
    builderRole: row.builder_role ? String(row.builder_role) : null,
    engagementPoints: Number(row.engagement_points ?? 0),
    backendUnlocked: Boolean(row.backend_unlocked),
  };
}

/**
 * Rewrite legacy DB photo URLs to the same-origin proxy path.
 * - http://127.0.0.1:54321/storage/v1/object/public/... → /api/photo/<id>
 * - Any other /storage/v1/... URL also gets rewritten (LAN/prod variant)
 * - data: URLs are returned as-is (used during the brief moment between
 *   capture and upload completion)
 * - Already-proxy paths and null pass through
 */
function rewritePhotoUrl(raw: unknown, participantId: string): string | null {
  if (!raw) return null;
  const url = String(raw);
  if (url.startsWith("/api/photo/")) return url;
  if (url.startsWith("data:")) return url;
  if (url.includes("/storage/v1/")) return `/api/photo/${participantId}`;
  return url;
}

function dataUrlToFile(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;

  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  const extension = mimeType === "image/png" ? "png" : "jpg";
  return { bytes, mimeType, extension };
}

async function uploadPhoto(participantId: string, photoUrl: string | null | undefined) {
  // v4: We always return the SAME-ORIGIN proxy path /api/photo/<id>.
  // Reasons (see app/api/photo/[participantId]/route.ts):
  //   - Supabase Storage public URLs leak the host (127.0.0.1 in local dev,
  //     unreachable from mobile LAN devices).
  //   - HTTPS pages can't load HTTP images (iOS Safari blocks mixed content).
  // The proxy fetches bytes server-side and serves them with the correct
  // content-type, fully same-origin HTTPS.
  if (!photoUrl) return null;

  // Legacy / external URL → just rewrite to proxy path. The proxy will look
  // up the file in Supabase Storage by participant id.
  if (!photoUrl.startsWith("data:")) {
    if (photoUrl.startsWith("/api/photo/")) return photoUrl;
    if (photoUrl.includes("/storage/v1/")) return `/api/photo/${participantId}`;
    return photoUrl;
  }

  // data URL — upload to Storage then return proxy path
  const supabase = getSupabaseAdminClient();
  const file = dataUrlToFile(photoUrl);
  if (!supabase || !file) return photoUrl;

  const path = `${participantId}/profile.${file.extension}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file.bytes, {
      contentType: file.mimeType,
      upsert: true,
    });

  if (error) {
    console.error("Supabase photo upload failed:", error);
    // Fall back to inline data URL so something still renders
    return photoUrl;
  }

  return `/api/photo/${participantId}`;
}

export async function listParticipants() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return Array.from(getMemoryStore().values()).sort((a, b) => b.output - a.output);
  }

  const { data, error } = await supabase
    .from("participants")
    .select(PARTICIPANT_SELECT)
    .order("output", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function upsertParticipant(input: ParticipantUpsert) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const store = getMemoryStore();
    const existing = store.get(input.id);
    const entry: WallParticipant = {
      id: input.id,
      displayId: input.displayId,
      displayName: input.displayName ?? existing?.displayName ?? null,
      phase: input.phase ?? existing?.phase ?? "UNREGISTERED",
      status: input.status ?? existing?.status ?? "MINING",
      verdict: input.verdict ?? existing?.verdict ?? null,
      output: input.output ?? existing?.output ?? 0,
      isOperator: input.isOperator ?? existing?.isOperator ?? false,
      joinedAt: existing?.joinedAt ?? Date.now(),
      lastSeenAt: Date.now(),
      photoUrl: input.photoUrl ?? existing?.photoUrl ?? null,
      scores: input.scores ?? existing?.scores,
      userRatingTier: input.userRatingTier ?? existing?.userRatingTier ?? null,
      tierClickMultiplier: input.tierClickMultiplier ?? existing?.tierClickMultiplier ?? 1.0,
      tierErrorRateFactor: input.tierErrorRateFactor ?? existing?.tierErrorRateFactor ?? 1.0,
      leisureGame: input.leisureGame ?? existing?.leisureGame ?? null,
      attackTokens: input.attackTokens ?? existing?.attackTokens ?? 0,
      archivedAt: input.archivedAt ?? existing?.archivedAt ?? null,
      isPermanent: input.isPermanent ?? existing?.isPermanent ?? false,
      isBuilder: input.isBuilder ?? existing?.isBuilder ?? false,
      builderRole: input.builderRole ?? existing?.builderRole ?? null,
      engagementPoints: input.engagementPoints ?? existing?.engagementPoints ?? 0,
      backendUnlocked: input.backendUnlocked ?? existing?.backendUnlocked ?? false,
    };
    store.set(input.id, entry);
    return entry;
  }

  const existing = await supabase
    .from("participants")
    .select("joined_at, photo_url")
    .eq("id", input.id)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const photoUrl = await uploadPhoto(input.id, input.photoUrl ?? undefined);
  const now = new Date().toISOString();

  // v4: only include columns when the caller actually provided them, so existing
  // values aren't clobbered on partial upserts.
  const payload: Record<string, unknown> = {
    id: input.id,
    display_id: input.displayId,
    status: input.status ?? "MINING",
    verdict: input.verdict ?? null,
    output: input.output ?? 0,
    is_operator: input.isOperator ?? false,
    joined_at: existing.data?.joined_at ?? now,
    last_seen_at: now,
    photo_url: photoUrl ?? existing.data?.photo_url ?? null,
    clarity_score: input.scores?.clarity_score ?? null,
    efficiency_score: input.scores?.efficiency_score ?? null,
    emotional_noise_score: input.scores?.emotional_noise_score ?? null,
    compliance_score: input.scores?.compliance_score ?? null,
  };

  if (input.displayName !== undefined) payload.display_name = input.displayName;
  if (input.phase !== undefined) payload.phase = input.phase;
  if (input.userRatingTier !== undefined) payload.user_rating_tier = input.userRatingTier;
  if (input.tierClickMultiplier !== undefined) payload.tier_click_multiplier = input.tierClickMultiplier;
  if (input.tierErrorRateFactor !== undefined) payload.tier_error_rate_factor = input.tierErrorRateFactor;
  if (input.leisureGame !== undefined) payload.leisure_game = input.leisureGame;
  if (input.attackTokens !== undefined) payload.attack_tokens = input.attackTokens;
  if (input.archivedAt !== undefined) {
    payload.archived_at = input.archivedAt ? new Date(input.archivedAt).toISOString() : null;
  }
  if (input.isPermanent !== undefined) payload.is_permanent = input.isPermanent;
  if (input.engagementPoints !== undefined) payload.engagement_points = input.engagementPoints;
  if (input.backendUnlocked !== undefined) payload.backend_unlocked = input.backendUnlocked;

  const { data, error } = await supabase
    .from("participants")
    .upsert(payload, { onConflict: "id" })
    .select(PARTICIPANT_SELECT)
    .single();

  if (error) throw error;
  return fromDb(data);
}
