// v4 Resend client wrapper.
// Reference: docs/v4-migration-plan.md Phase 12; project_v4 III. 阶段 8
//
// Uses plain fetch against the Resend REST API rather than the SDK to avoid
// adding a runtime dependency. Falls back to console.log in development
// (no RESEND_API_KEY) so the cron / enqueue path can be tested end-to-end
// without burning live emails.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  mocked?: boolean;
}

export async function sendEmail({ to, subject, html, from }: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = from ?? process.env.EMAIL_FROM ?? "system@self-distill.art";

  if (!apiKey) {
    // Mock mode — log so devs can verify the schedule works.
    console.info(`[email:mock] → ${to}`, { subject, preview: html.slice(0, 120) });
    return { ok: true, mocked: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${text}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
