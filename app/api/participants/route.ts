import { NextRequest, NextResponse } from "next/server";
import {
  listParticipants,
  upsertParticipant,
} from "@/lib/participants/repository";
import type { ParticipantUpsert, WallParticipant } from "@/lib/participants/types";

export type { WallParticipant };

export async function GET() {
  try {
    const participants = await listParticipants();
    return NextResponse.json(participants, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/participants error:", error);
    return NextResponse.json(
      { error: "Failed to load participants" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ParticipantUpsert = await req.json();

    if (!body.id || !body.displayId) {
      return NextResponse.json(
        { error: "id and displayId are required" },
        { status: 400 }
      );
    }

    const participant = await upsertParticipant(body);
    return NextResponse.json({ ok: true, participant });
  } catch (error) {
    console.error("POST /api/participants error:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
