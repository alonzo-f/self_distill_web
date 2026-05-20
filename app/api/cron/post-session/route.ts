// v4 aftermath cron — scans scheduled_messages and dispatches due emails.
// Reference: docs/v4-migration-plan.md Phase 12; project_v4 III. 阶段 8
//
// Triggered by Vercel Cron every hour (configured in vercel.json).
// Authorization: requires Bearer ${CRON_SECRET} header when in production.
//
// For each row with status='scheduled' AND scheduled_for <= now():
//   1. Look up the participant (for display_id / display_name).
//   2. Render the AftermathKey template stored in message_content.
//   3. Send via Resend (mock in dev).
//   4. Mark row as 'sent' (or 'failed' with error_message).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import {
  renderTemplate,
  type AftermathKey,
} from "@/lib/email/templates";

const MAX_BATCH = 25;

export async function GET(req: NextRequest) {
  // Vercel Cron auth (skip in local dev where CRON_SECRET is unset)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, dispatched: 0, mocked: true });
  }

  const nowIso = new Date().toISOString();

  // Find due rows
  const { data: due, error: dueErr } = await supabase
    .from("scheduled_messages")
    .select("id, participant_id, contact, message_content, scheduled_for")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .limit(MAX_BATCH);

  if (dueErr) {
    console.error("cron query error:", dueErr);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, dispatched: 0 });
  }

  // Bulk-load participants for personalization
  const participantIds = Array.from(
    new Set(due.map((r) => r.participant_id).filter((v): v is string => Boolean(v))),
  );

  const participantMap = new Map<
    string,
    { display_id: string; display_name: string | null }
  >();
  if (participantIds.length > 0) {
    const { data: pRows, error: pErr } = await supabase
      .from("participants")
      .select("id, display_id, display_name")
      .in("id", participantIds);
    if (pErr) {
      console.error("cron participants load error:", pErr);
    } else {
      for (const p of pRows ?? []) {
        participantMap.set(String(p.id), {
          display_id: String(p.display_id),
          display_name: p.display_name ? String(p.display_name) : null,
        });
      }
    }
  }

  const origin = process.env.SITE_ORIGIN ?? new URL(req.url).origin;
  let dispatched = 0;

  for (const row of due) {
    const key = row.message_content as AftermathKey;
    if (!isValidKey(key)) {
      await markFailed(supabase, row.id, `Invalid template key: ${String(key)}`);
      continue;
    }
    const pInfo = row.participant_id ? participantMap.get(String(row.participant_id)) : null;
    if (!pInfo) {
      await markFailed(supabase, row.id, "Participant no longer exists");
      continue;
    }

    const tpl = renderTemplate(key, {
      displayId: pInfo.display_id,
      displayName: pInfo.display_name,
      participantId: String(row.participant_id),
      origin,
    });

    const result = await sendEmail({
      to: String(row.contact),
      subject: tpl.subject,
      html: tpl.html,
    });

    if (result.ok) {
      await supabase
        .from("scheduled_messages")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      dispatched++;
    } else {
      await markFailed(supabase, row.id, result.error ?? "Unknown send error");
    }
  }

  return NextResponse.json({ ok: true, dispatched });
}

async function markFailed(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  id: string,
  message: string,
) {
  await supabase
    .from("scheduled_messages")
    .update({ status: "failed", error_message: message })
    .eq("id", id);
}

function isValidKey(k: unknown): k is AftermathKey {
  return (
    k === "passport" ||
    k === "report" ||
    k === "silence" ||
    k === "final" ||
    k === "thanks"
  );
}
