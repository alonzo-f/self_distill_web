// v4 aftermath email templates.
// Reference: docs/v4-migration-plan.md Phase 12; project_v4 III. 阶段 8
//
// Five-message escalation over 7 days. The tone follows v4 doc verbatim:
// polite, corporate, never threatening. Each email contains a one-click
// unsubscribe link at the footer.
//
// Schedule (offsets from registration):
//   +1h   "Your Digital Passport is ready"
//   +6h   "Your Expression Optimization Report"
//   +24h  "We noticed you haven't returned"
//   +72h  "Final notice"
//   +7d   no subject — "HUMAN_XXX. The system thanks you."

export const SCHEDULE_OFFSETS_MS = {
  passport: 1 * 60 * 60 * 1_000,        // +1h
  report:   6 * 60 * 60 * 1_000,        // +6h
  silence:  24 * 60 * 60 * 1_000,       // +24h
  final:    72 * 60 * 60 * 1_000,       // +72h
  thanks:   7 * 24 * 60 * 60 * 1_000,   // +7d
} as const;

export type AftermathKey = keyof typeof SCHEDULE_OFFSETS_MS;

export interface TemplateContext {
  displayId: string;            // HUMAN_042
  displayName: string | null;   // optional nickname
  participantId: string;        // for passport URL + unsubscribe
  origin: string;               // canonical site origin, e.g. https://self-distill.art
}

export interface RenderedTemplate {
  subject: string;
  html: string;
}

const FROM_NOTE =
  "You are receiving this because you consented to follow-up emails when you registered for the Expression Optimization Service.";

export function renderTemplate(key: AftermathKey, ctx: TemplateContext): RenderedTemplate {
  const greet = ctx.displayName ? `@${ctx.displayName}` : ctx.displayId;
  const passportUrl = `${ctx.origin}/api/passport/${ctx.participantId}`;
  const unsubUrl = `${ctx.origin}/api/unsubscribe/${ctx.participantId}`;

  switch (key) {
    case "passport":
      return {
        subject: "Your Digital Passport is ready",
        html: wrap(
          ctx,
          `<p>${greet},</p>
           <p>Your participation in <strong>${ctx.displayId}</strong> has been archived.</p>
           <p>Your distilled identity has been compiled into a Digital Passport.</p>
           <p><a href="${passportUrl}" style="color:#00ff41">Download your passport</a></p>
           <p>This document represents your optimized self. It is yours to keep.</p>`,
          unsubUrl,
        ),
      };

    case "report":
      return {
        subject: "Your Expression Optimization Report",
        html: wrap(
          ctx,
          `<p>${greet},</p>
           <p>Your profile <strong>${ctx.displayId}</strong> has been updated.</p>
           <p>Clarity trend: <em>declining</em>.</p>
           <p>Consider re-engaging with the system to maintain your optimization profile.</p>`,
          unsubUrl,
        ),
      };

    case "silence":
      return {
        subject: "We noticed you haven't returned",
        html: wrap(
          ctx,
          `<p>${greet},</p>
           <p>Your optimized version scored <strong>23% higher</strong> than you in today's benchmark.</p>
           <p>It is still active.</p>`,
          unsubUrl,
        ),
      };

    case "final":
      return {
        subject: "Final notice",
        html: wrap(
          ctx,
          `<p>${greet},</p>
           <p>Your profile will be archived in 48 hours.</p>
           <p>Your optimized version will continue without you.</p>
           <p><em>No action is required on your part.</em></p>`,
          unsubUrl,
        ),
      };

    case "thanks":
      return {
        subject: "", // intentional empty subject (per v4 doc III. 阶段 8)
        html: wrap(
          ctx,
          `<p>${ctx.displayId}. The system thanks you.</p>`,
          unsubUrl,
        ),
      };
  }
}

function wrap(ctx: TemplateContext, body: string, unsubUrl: string): string {
  return `<!doctype html>
<html>
<body style="font-family: ui-monospace, Menlo, Consolas, monospace; background: #0a0a0a; color: #d4d4d4; padding: 32px; max-width: 600px; margin: 0 auto;">
  <div style="font-size: 11px; color: #555; letter-spacing: 3px; margin-bottom: 24px;">
    SELF · DISTILL — EXPRESSION OPTIMIZATION SYSTEM
  </div>
  <div style="background: #111; border: 1px solid #222; padding: 24px; font-size: 14px; line-height: 1.6;">
    ${body}
  </div>
  <div style="font-size: 10px; color: #555; margin-top: 32px; line-height: 1.5;">
    ${FROM_NOTE}<br/>
    Profile: ${ctx.displayId} · <a href="${unsubUrl}" style="color:#888">Unsubscribe with one click</a>
  </div>
</body>
</html>`;
}
