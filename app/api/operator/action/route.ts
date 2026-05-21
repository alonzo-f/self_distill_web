// v4 operator action endpoint.
// Reference: docs/v4-migration-plan.md Phase 10; project_v4 III. 阶段 6 关键机制 ③
//
// Records an operator action (FLAG / THROTTLE / BOOST / REPORT) and
// applies its server-side effect. The wall picks up the change via the
// participants broadcast trigger (auto-fires on UPDATE).
//
// Action semantics (target = the operated participant):
//   FLAG     just records — wall renders a flag overlay; no field mutation.
//   THROTTLE multiplies target.tier_click_multiplier by 0.8 (i.e. -20%).
//   BOOST    multiplies attacker.tier_click_multiplier by 1.2 (rewards bullying).
//   REPORT   sets target.status = "LEISURE" — kicks them out of production.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OperatorActionType } from "@/types";

interface OperatorActionBody {
  sourceId: string;
  targetId: string;
  actionType: OperatorActionType;
}

const THROTTLE_FACTOR = 0.8;
const BOOST_FACTOR = 1.2;

export async function POST(req: NextRequest) {
  let body: OperatorActionBody;
  try {
    body = (await req.json()) as OperatorActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.sourceId || !body.targetId || !body.actionType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (body.sourceId === body.targetId) {
    return NextResponse.json({ error: "Self-action not allowed" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, fallback: true });
  }

  // Load both rows in one query
  const { data: rows, error: loadErr } = await supabase
    .from("participants")
    .select(
      "id, display_id, status, is_permanent, operator_eligible, tier_click_multiplier",
    )
    .in("id", [body.sourceId, body.targetId]);

  if (loadErr) {
    console.error("operator load error:", loadErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  const source = rows?.find((r) => r.id === body.sourceId);
  const target = rows?.find((r) => r.id === body.targetId);
  if (!source || !target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!source.operator_eligible) {
    return NextResponse.json({ error: "Not an operator" }, { status: 403 });
  }
  if (target.is_permanent) {
    return NextResponse.json({ error: "Cannot operate on permanent participant" }, { status: 403 });
  }

  // Apply attacker-side bonuses (target always archived below)
  if (body.actionType === "BOOST") {
    await supabase
      .from("participants")
      .update({
        tier_click_multiplier: Math.min(
          3.0,
          Number(source.tier_click_multiplier ?? 1.0) * BOOST_FACTOR,
        ),
      })
      .eq("id", source.id);
  }
  // THROTTLE / FLAG / REPORT side effects are now subsumed by archival.
  // THROTTLE's click multiplier penalty doesn't matter — target is archived.
  void THROTTLE_FACTOR;

  // v4 调整 (用户需求): 任何 operator 操作都将 target 归档.
  // FLAG/THROTTLE/BOOST/REPORT 在叙事上都是"清除一个低效节点".
  await supabase
    .from("participants")
    .update({
      status: "ARCHIVED",
      phase: "GHOST",
      archived_at: new Date().toISOString(),
    })
    .eq("id", target.id);

  const { error: insErr } = await supabase.from("operator_actions").insert({
    source_participant_id: source.id,
    target_participant_id: target.id,
    action_type: body.actionType,
    action_data: {},
  });
  if (insErr) {
    console.error("operator log insert error:", insErr);
  }

  return NextResponse.json({
    ok: true,
    sourceDisplayId: source.display_id,
    targetDisplayId: target.display_id,
    actionType: body.actionType,
  });
}
