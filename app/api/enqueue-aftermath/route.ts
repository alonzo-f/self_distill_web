// v4 enqueue helper for the 5-message aftermath sequence.
// Reference: docs/v4-migration-plan.md Phase 12
//
// Called from /register's submit handler when the user opted into the
// follow-up emails. Validates inputs and delegates to lib/email/scheduler.

import { NextRequest, NextResponse } from "next/server";
import { enqueueAftermathSequence } from "@/lib/email/scheduler";

interface Body {
  participantId: string;
  email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.participantId || !UUID_RE.test(body.participantId)) {
    return NextResponse.json({ error: "Invalid participantId" }, { status: 400 });
  }
  if (!body.email || !EMAIL_RE.test(body.email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const result = await enqueueAftermathSequence({
    participantId: body.participantId,
    email: body.email,
  });

  return NextResponse.json(result);
}
