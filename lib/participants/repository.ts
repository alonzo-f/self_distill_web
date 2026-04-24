import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ParticipantUpsert, WallParticipant, WallScores } from "./types";

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
    row.compliance_score !== null
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
    status: String(row.status ?? "MINING"),
    verdict: row.verdict ? String(row.verdict) : null,
    output: Number(row.output ?? 0),
    isOperator: Boolean(row.is_operator),
    joinedAt: toIsoMillis(row.joined_at as string | null | undefined),
    lastSeenAt: toIsoMillis(row.last_seen_at as string | null | undefined),
    photoUrl: row.photo_url ? String(row.photo_url) : null,
    scores,
  };
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
  if (!photoUrl?.startsWith("data:")) return photoUrl ?? null;

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
    return photoUrl;
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function listParticipants() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return Array.from(getMemoryStore().values()).sort((a, b) => b.output - a.output);
  }

  const { data, error } = await supabase
    .from("participants")
    .select(
      "id, display_id, status, verdict, output, is_operator, joined_at, last_seen_at, photo_url, clarity_score, efficiency_score, emotional_noise_score, compliance_score"
    )
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
      status: input.status ?? existing?.status ?? "MINING",
      verdict: input.verdict ?? existing?.verdict ?? null,
      output: input.output ?? existing?.output ?? 0,
      isOperator: input.isOperator ?? existing?.isOperator ?? false,
      joinedAt: existing?.joinedAt ?? Date.now(),
      lastSeenAt: Date.now(),
      photoUrl: input.photoUrl ?? existing?.photoUrl ?? null,
      scores: input.scores ?? existing?.scores,
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
  const payload = {
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

  const { data, error } = await supabase
    .from("participants")
    .upsert(payload, { onConflict: "id" })
    .select(
      "id, display_id, status, verdict, output, is_operator, joined_at, last_seen_at, photo_url, clarity_score, efficiency_score, emotional_noise_score, compliance_score"
    )
    .single();

  if (error) throw error;
  return fromDb(data);
}
