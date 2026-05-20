// v4 email scheduler — enqueues the 5-message aftermath sequence.
// Reference: docs/v4-migration-plan.md Phase 12; project_v4 III. 阶段 8

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SCHEDULE_OFFSETS_MS, type AftermathKey } from "@/lib/email/templates";

interface EnqueueArgs {
  participantId: string;
  email: string;
}

const KEYS: AftermathKey[] = ["passport", "report", "silence", "final", "thanks"];

/**
 * Inserts five rows into `scheduled_messages` with staggered `scheduled_for`
 * timestamps. The cron handler picks them up at /api/cron/post-session.
 *
 * `message_content` holds the AftermathKey so the cron handler can re-render
 * the body at send time (templates may evolve; we don't bake HTML at enqueue).
 */
export async function enqueueAftermathSequence({
  participantId,
  email,
}: EnqueueArgs): Promise<{ ok: boolean; count: number }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.info("[email:scheduler] no supabase, skipping enqueue for", email);
    return { ok: false, count: 0 };
  }

  const now = Date.now();
  const rows = KEYS.map((key) => ({
    participant_id: participantId,
    contact: email,
    channel: "email" as const,
    message_content: key,                       // template key, NOT html
    scheduled_for: new Date(now + SCHEDULE_OFFSETS_MS[key]).toISOString(),
    status: "scheduled" as const,
  }));

  const { error } = await supabase.from("scheduled_messages").insert(rows);
  if (error) {
    console.error("scheduler: enqueue failed", error);
    return { ok: false, count: 0 };
  }
  return { ok: true, count: rows.length };
}
