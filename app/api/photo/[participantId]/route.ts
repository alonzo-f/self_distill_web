// v4 photo proxy.
// Reference: docs/v4-migration-plan.md Phase 1 (mobile fix)
//
// Why this exists:
//   - Supabase Storage public URLs include the host
//     (http://127.0.0.1:54321/... in local dev). Mobile devices on the LAN
//     interpret 127.0.0.1 as themselves → image not found.
//   - Even if we rewrote to LAN IP, the page is HTTPS while Supabase Storage
//     is HTTP → iOS Safari blocks the mixed content.
//   - This endpoint sits on the same origin as the page (HTTPS), proxies
//     server-side over to Supabase Storage, and streams the bytes back.
//
// Storage convention: each participant has at most one photo, saved at
// `participant-photos/<participantId>/profile.{jpg,png}`. We try jpg first,
// then png.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "participant-photos";
const EXTENSIONS = ["jpg", "png"] as const;

interface Ctx {
  params: Promise<{ participantId: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { participantId } = await ctx.params;
  if (!participantId || !/^[0-9a-f-]{36}$/i.test(participantId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  for (const ext of EXTENSIONS) {
    const path = `${participantId}/profile.${ext}`;
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) continue;
    const buf = Buffer.from(await data.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ext === "png" ? "image/png" : "image/jpeg",
        // Photos are immutable per participant — safe to cache a few minutes.
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
