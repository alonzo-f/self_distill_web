// v4 backdoor attack endpoint.
// Reference: docs/v4-migration-plan.md Phase 9; project_v4 III. 阶段 6.8
//
// Records a backdoor attack and applies its side effects:
//   SIPHON   transfer `amount` (default 50) from target.mining_credits → attacker.mining_credits
//   CORRUPT  marks the target with a transient flag (Phase 9 ships persistence;
//            the /mine page would consume it in Phase 9b — not yet wired)
//   SWAP     swaps attacker.output ↔ target.output (visible immediately on wall)
//
// Decrements attacker.attack_tokens. Refuses when tokens are exhausted.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BackdoorAttackType } from "@/types";

interface AttackBody {
  attackerId: string;
  targetId: string;
  actionType: BackdoorAttackType;
  amount?: number;
}

export async function POST(req: NextRequest) {
  let body: AttackBody;
  try {
    body = (await req.json()) as AttackBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.attackerId || !body.targetId || !body.actionType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (body.attackerId === body.targetId) {
    return NextResponse.json({ error: "Self-attack not allowed" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, fallback: true });
  }

  // Load both participants in one round trip
  const { data: rows, error } = await supabase
    .from("participants")
    .select("id, mining_credits, attack_tokens, output, is_permanent, display_id")
    .in("id", [body.attackerId, body.targetId]);

  if (error) {
    console.error("attack lookup error:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  const attacker = rows?.find((r) => r.id === body.attackerId);
  const target = rows?.find((r) => r.id === body.targetId);
  if (!attacker || !target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.is_permanent) {
    return NextResponse.json({ error: "Cannot attack permanent participant" }, { status: 403 });
  }
  if ((attacker.attack_tokens ?? 0) <= 0) {
    return NextResponse.json({ error: "No tokens" }, { status: 403 });
  }

  const amount = body.amount ?? 50;
  const updates: { id: string; patch: Record<string, unknown> }[] = [];

  if (body.actionType === "SIPHON") {
    const transfer = Math.min(amount, target.mining_credits ?? 0);
    // Attacker still gains the credits (narrative: "you took theirs")
    updates.push({
      id: attacker.id,
      patch: { mining_credits: (attacker.mining_credits ?? 0) + transfer },
    });
  } else if (body.actionType === "SWAP") {
    // Attacker steals the target's output before archival
    updates.push({ id: attacker.id, patch: { output: target.output ?? 0 } });
  }
  // CORRUPT: no extra side effect — pure archival

  // v4 调整 (用户需求): 任何 backdoor 攻击都将 target 归档
  // (status=ARCHIVED + phase=GHOST + archived_at), 即"击杀".
  updates.push({
    id: target.id,
    patch: {
      status: "ARCHIVED",
      phase: "GHOST",
      archived_at: new Date().toISOString(),
    },
  });

  for (const u of updates) {
    const { error: upErr } = await supabase
      .from("participants")
      .update(u.patch)
      .eq("id", u.id);
    if (upErr) {
      console.error("attack update error:", upErr);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  // Decrement attacker's tokens
  const { error: tokErr } = await supabase
    .from("participants")
    .update({ attack_tokens: Math.max(0, (attacker.attack_tokens ?? 0) - 1) })
    .eq("id", attacker.id);
  if (tokErr) {
    console.error("token decrement error:", tokErr);
  }

  // Record the attack
  const { error: insErr } = await supabase.from("backdoor_attacks").insert({
    attacker_id: attacker.id,
    target_id: target.id,
    action_type: body.actionType,
    amount,
  });
  if (insErr) {
    console.error("attack insert error:", insErr);
  }

  return NextResponse.json({
    ok: true,
    attackerDisplayId: attacker.display_id,
    targetDisplayId: target.display_id,
    actionType: body.actionType,
    amount,
    remainingTokens: Math.max(0, (attacker.attack_tokens ?? 0) - 1),
  });
}
