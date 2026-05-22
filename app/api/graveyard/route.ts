// v4 graveyard data endpoint.
// Reference: docs/v4-migration-plan.md Phase 8; project_v4 IV. 投影墙 D 板块
//
// Lists archived participants + Builder permanent anchors.
// Designed to be polled every 30s by the projection wall, not Realtime.
//
// Returns nicknames only (per v4 鬼魂 dehumanization rule). The wall
// renders Builder rows in gold and pushes them to the bottom of the list.

import { NextResponse } from "next/server";
import { getSupabaseAdminClient, markSupabaseDown } from "@/lib/supabase/admin";
import { listParticipants } from "@/lib/participants/repository";
import type { GraveyardEntry } from "@/lib/participants/types";

const MAX_RECENT_ARCHIVED = 12;

/**
 * v4 (2026-05-22): build a graveyard payload from the in-memory store
 * (which `listParticipants` returns when Supabase is missing or unreachable).
 * Keeps the wall responsive in a single-process dev setup with no Docker.
 */
async function memoryGraveyard(): Promise<GraveyardEntry[]> {
  const all = await listParticipants();
  const archived = all
    .filter((p) => !p.isPermanent && p.archivedAt)
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
    .slice(0, MAX_RECENT_ARCHIVED)
    .map<GraveyardEntry>((p) => ({
      displayName: p.displayName ?? "",
      archivedAt: p.archivedAt ? new Date(p.archivedAt).toISOString() : null,
      isPermanent: false,
    }));

  const builders = all
    .filter((p) => p.isPermanent)
    .sort((a, b) => a.displayId.localeCompare(b.displayId))
    .map<GraveyardEntry>((p) => ({
      displayName: p.displayName ?? "",
      archivedAt: p.archivedAt ? new Date(p.archivedAt).toISOString() : null,
      isPermanent: true,
    }));

  // Always surface the Builder anchors, even if the memory store is empty.
  const seen = new Set(builders.map((b) => b.displayName));
  const merged = [
    ...archived,
    ...builders,
    ...BUILDER_FALLBACK.filter((b) => !seen.has(b.displayName)),
  ];
  return merged;
}

export async function GET() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const entries = await memoryGraveyard();
    return NextResponse.json(
      { entries } satisfies GraveyardResponse,
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    // 1. Recently archived (non-permanent) users, newest first.
    const { data: archived, error: arErr } = await supabase
      .from("participants")
      .select("display_name, archived_at, is_permanent")
      .eq("is_permanent", false)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(MAX_RECENT_ARCHIVED);

    if (arErr) throw arErr;

    // 2. Permanent Builder anchors (always shown, sorted by display_id).
    const { data: builders, error: bErr } = await supabase
      .from("participants")
      .select("display_name, archived_at, is_permanent")
      .eq("is_permanent", true)
      .order("display_id", { ascending: true });

    if (bErr) throw bErr;

    const entries: GraveyardEntry[] = [
      ...(archived ?? []).map((r) => ({
        displayName: String(r.display_name ?? ""),
        archivedAt: r.archived_at ? String(r.archived_at) : null,
        isPermanent: false,
      })),
      ...(builders ?? []).map((r) => ({
        displayName: String(r.display_name ?? ""),
        archivedAt: r.archived_at ? String(r.archived_at) : null,
        isPermanent: true,
      })),
    ];

    return NextResponse.json(
      { entries } satisfies GraveyardResponse,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // v4 (2026-05-22): Supabase configured but unreachable — same graceful
    // fallback path used by /api/participants. The memory store is shared
    // across all routes in this Node process, so the wall will still see
    // archives produced by mobile clients hitting the same dev server.
    console.warn("[graveyard] Supabase unreachable, using memory store:", err);
    markSupabaseDown();
    const entries = await memoryGraveyard();
    return NextResponse.json(
      { entries } satisfies GraveyardResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}

interface GraveyardResponse {
  entries: GraveyardEntry[];
}

const BUILDER_FALLBACK: GraveyardEntry[] = [
  { displayName: "BUILDER_01", archivedAt: null, isPermanent: true },
  { displayName: "BUILDER_02", archivedAt: null, isPermanent: true },
];
