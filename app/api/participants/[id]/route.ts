// v4 GDPR hard-delete endpoint for Start Over.
// Reference: docs/v4-migration-plan.md Phase 3; project_v4 III. 阶段 0.5
//
// Deletes the participant row. Cascade rules on calibration_answers,
// operator_actions, leisure_actions, scheduled_messages, backdoor_attacks
// all reference participants.id with ON DELETE CASCADE so a single delete
// is sufficient.
//
// Permanent rows (is_permanent=true, i.e. BUILDER_01/02) are refused.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    // No DB configured (local fallback). Pretend success.
    return NextResponse.json({ ok: true, fallback: true });
  }

  // Guard against deleting Builder anchors.
  const { data: existing, error: lookupErr } = await supabase
    .from("participants")
    .select("id, is_permanent")
    .eq("id", id)
    .maybeSingle();

  if (lookupErr) {
    console.error("DELETE /api/participants lookup error:", lookupErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ ok: true, alreadyMissing: true });
  }

  if (existing.is_permanent) {
    return NextResponse.json(
      { error: "Cannot delete permanent participant" },
      { status: 403 },
    );
  }

  const { error: delErr } = await supabase.from("participants").delete().eq("id", id);
  if (delErr) {
    console.error("DELETE /api/participants delete error:", delErr);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
