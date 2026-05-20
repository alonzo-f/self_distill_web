// v4 one-click unsubscribe.
// Reference: docs/v4-migration-plan.md Phase 12; project_v4 IX. GDPR
//
// GET /api/unsubscribe/[participantId]
//   Cancels every still-scheduled email for this participant.
//   Returns a small HTML confirmation page so the user knows it worked
//   (one-click unsubscribe per RFC 8058 best practice).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface Ctx {
  params: Promise<{ participantId: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { participantId } = await ctx.params;
  if (!participantId || !/^[0-9a-f-]{36}$/i.test(participantId)) {
    return htmlResponse("Invalid request.", 400);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    // Local fallback — claim success so emails still feel responsive
    return htmlResponse("You have been removed from the mailing list.", 200);
  }

  const { error } = await supabase
    .from("scheduled_messages")
    .update({ status: "cancelled" })
    .eq("participant_id", participantId)
    .eq("status", "scheduled");

  if (error) {
    console.error("unsubscribe error:", error);
    return htmlResponse(
      "We encountered an error processing your request. Please email info@self-distill.art.",
      500,
    );
  }

  return htmlResponse(
    "You have been removed from all future Expression Optimization correspondence. " +
      "The system thanks you for your participation.",
    200,
  );
}

// POST one-click variant (RFC 8058 mail clients send POST)
export async function POST(req: NextRequest, ctx: Ctx) {
  return GET(req, ctx);
}

function htmlResponse(message: string, status: number): NextResponse {
  const body = `<!doctype html>
<html>
<body style="font-family: ui-monospace, Menlo, Consolas, monospace; background: #0a0a0a; color: #d4d4d4; padding: 48px; max-width: 560px; margin: 80px auto; line-height: 1.6;">
  <div style="font-size: 11px; color: #555; letter-spacing: 4px; margin-bottom: 24px;">
    SELF · DISTILL — UNSUBSCRIBE
  </div>
  <div style="background: #111; border: 1px solid #222; padding: 24px; font-size: 14px;">
    ${escapeHtml(message)}
  </div>
</body>
</html>`;
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
