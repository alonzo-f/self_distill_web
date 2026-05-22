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
import { getSupabaseAdminClient, markSupabaseDown } from "@/lib/supabase/admin";
import { listParticipants, upsertParticipant } from "@/lib/participants/repository";
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
    // v4 (2026-05-22, 修改0519.md item 6+7): in-memory fallback so attacks
    // work end-to-end with no DB. Marks the target archived, decrements
    // attacker's tokens, returns enough info for the client to play the
    // kill animation on the wall.
    return await memoryAttack(body);
  }

  // Load both participants in one round trip.
  // v4 (2026-05-22): if Supabase is configured but unreachable (e.g. local
  // Docker down), this throws ECONNREFUSED. Catch and fall through to the
  // memory store so the attack still completes and the user redirects to
  // /wall as expected.
  type Row = {
    id: string;
    mining_credits: number | null;
    attack_tokens: number | null;
    output: number | null;
    is_permanent: boolean | null;
    display_id: string | null;
  };
  let rows: Row[] = [];
  try {
    const result = await supabase
      .from("participants")
      .select("id, mining_credits, attack_tokens, output, is_permanent, display_id")
      .in("id", [body.attackerId, body.targetId]);
    if (result.error) throw result.error;
    rows = (result.data ?? []) as Row[];
  } catch (err) {
    console.warn("[attack] Supabase unreachable on lookup, using memory store:", err);
    markSupabaseDown();
    return await memoryAttack(body);
  }

  const attacker = rows.find((r) => r.id === body.attackerId);
  const target = rows.find((r) => r.id === body.targetId);
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

/**
 * v4 (2026-05-22): in-memory fallback for the attack endpoint when Supabase
 * is unavailable. Mirrors the SIPHON / SWAP / CORRUPT / archive logic above
 * but writes through the shared memory store so the wall sees the kill on
 * its next poll.
 */
async function memoryAttack(body: AttackBody) {
  const all = await listParticipants();
  const attacker = all.find((p) => p.id === body.attackerId);
  const target = all.find((p) => p.id === body.targetId);

  if (!attacker || !target) {
    // Attacker may not be in memory if their session lived only on the
    // client. Still allow the attack to register against the target so
    // the wall plays the kill animation.
    if (!target) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }
  }
  if (target.isPermanent) {
    return NextResponse.json({ error: "Cannot attack permanent participant" }, { status: 403 });
  }

  const amount = body.amount ?? 50;

  // Apply side-effects against the target row.
  await upsertParticipant({
    id: target.id,
    displayId: target.displayId,
    displayName: target.displayName ?? null,
    status: "ARCHIVED",
    phase: "GHOST",
    archivedAt: Date.now(),
    // SWAP: target loses output (transferred to attacker below)
    output: body.actionType === "SWAP" ? attacker?.output ?? 0 : target.output,
  });

  if (attacker) {
    const patch: Record<string, unknown> = {
      id: attacker.id,
      displayId: attacker.displayId,
      displayName: attacker.displayName ?? null,
      attackTokens: Math.max(0, (attacker.attackTokens ?? 1) - 1),
    };
    if (body.actionType === "SWAP") {
      patch.output = target.output ?? 0;
    }
    await upsertParticipant(patch as Parameters<typeof upsertParticipant>[0]);
  }

  return NextResponse.json({
    ok: true,
    fallback: true,
    attackerDisplayId: attacker?.displayId ?? null,
    targetDisplayId: target.displayId,
    actionType: body.actionType,
    amount,
    remainingTokens: Math.max(0, (attacker?.attackTokens ?? 1) - 1),
  });
}
