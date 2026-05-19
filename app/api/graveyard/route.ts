// v4 graveyard data endpoint.
// Reference: docs/v4-migration-plan.md Phase 8; project_v4 IV. 投影墙 D 板块
//
// Lists archived participants + Builder permanent anchors.
// Designed to be polled every 30s by the projection wall, not Realtime.
//
// Returns nicknames only (per v4 鬼魂 dehumanization rule). The wall
// renders Builder rows in gold and pushes them to the bottom of the list.

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GraveyardEntry } from "@/lib/participants/types";

const MAX_RECENT_ARCHIVED = 12;

export async function GET() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { entries: BUILDER_FALLBACK } satisfies GraveyardResponse,
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
    console.error("GET /api/graveyard error:", err);
    return NextResponse.json(
      { entries: BUILDER_FALLBACK } satisfies GraveyardResponse,
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
