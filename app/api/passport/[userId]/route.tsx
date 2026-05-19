// v4 digital passport image generator.
// Reference: docs/v4-migration-plan.md Phase 9; project_v4 III. 阶段 6.7c
//
// Generates a 1080×1920 PNG that the user can download / share. The
// "long-tail virality" path of v4: every shared passport is a participant
// telling the outside world "I was distilled."
//
// Implementation: uses next/og (Vercel's ImageResponse). The JSX is
// constrained — no Tailwind, no <img loading=lazy>, no client hooks.

import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface Ctx {
  params: Promise<{ userId: string }>;
}

const W = 1080;
const H = 1920;

const BG = "#0a0a0a";
const GREEN = "#00ff41";
const AMBER = "#ffb86c";
const DIM = "#888888";
const TEXT = "#d4d4d4";

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  let row: PassportRow = FALLBACK_ROW;

  if (supabase) {
    const { data, error } = await supabase
      .from("participants")
      .select(
        "id, display_id, display_name, photo_url, verdict, clarity_score, efficiency_score, emotional_noise_score, compliance_score, original_text, distilled_text, output, user_rating_tier, is_permanent",
      )
      .eq("id", userId)
      .maybeSingle();
    if (!error && data) row = mapRow(data);
  }

  const hash = shortHash(userId);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: BG,
          color: TEXT,
          display: "flex",
          flexDirection: "column",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
          padding: 48,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            color: DIM,
            fontSize: 22,
            letterSpacing: 6,
          }}
        >
          <div>SELF · DISTILL</div>
          <div>EXPRESSION OPTIMIZATION PASSPORT</div>
        </div>

        <div style={{ height: 2, background: "#222", marginTop: 16, marginBottom: 24, display: "flex" }} />

        {/* Photo + identity */}
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {row.photoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
            <img
              src={row.photoUrl}
              width={220}
              height={220}
              style={{ objectFit: "cover", border: `2px solid ${GREEN}` }}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 220,
                background: "#1a1a1a",
                border: `2px solid ${DIM}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: DIM,
                fontSize: 18,
              }}
            >
              [no photo]
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ color: GREEN, fontSize: 56, fontWeight: 700 }}>{row.displayId}</div>
            {row.displayName && (
              <div style={{ color: DIM, fontSize: 28 }}>@{row.displayName}</div>
            )}
            <div
              style={{
                color: row.verdict === "DISTILLED" ? GREEN : AMBER,
                fontSize: 24,
                letterSpacing: 4,
                marginTop: 8,
              }}
            >
              {row.verdict ?? "PENDING"}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "#222", marginTop: 36, marginBottom: 24, display: "flex" }} />

        {/* Score grid */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ScoreCell label="CLARITY" value={row.clarity} />
          <ScoreCell label="EFFICIENCY" value={row.efficiency} />
          <ScoreCell label="EMOTIONAL NOISE" value={row.emotionalNoise} />
          <ScoreCell label="COMPLIANCE" value={row.compliance} />
        </div>

        <div style={{ height: 1, background: "#222", marginTop: 28, marginBottom: 24, display: "flex" }} />

        {/* Original answer */}
        <Section title="YOUR INPUT">
          <div style={{ color: TEXT, fontSize: 24, lineHeight: 1.45, display: "flex" }}>
            {(row.originalText || "—").slice(0, 240)}
          </div>
        </Section>

        <div style={{ height: 18, display: "flex" }} />

        {/* Distilled answer */}
        <Section title="OPTIMIZED OUTPUT">
          <div style={{ color: GREEN, fontSize: 24, lineHeight: 1.45, display: "flex" }}>
            {(row.distilledText || "—").slice(0, 240)}
          </div>
        </Section>

        <div style={{ flex: 1, display: "flex" }} />

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            color: DIM,
            fontSize: 20,
            letterSpacing: 3,
          }}
        >
          <div>
            HASH {hash} · OUTPUT {row.output} · TIER {row.userRatingTier ?? "—"}
          </div>
          <div>You found the backdoor.</div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            color: AMBER,
            fontSize: 18,
            letterSpacing: 5,
            marginTop: 10,
          }}
        >
          {row.isPermanent ? "FOUNDATION MEMBER · ETERNAL ARCHIVE" : "ARCHIVED"}
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}

function ScoreCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 220,
        border: `1px solid #2a2a2a`,
        padding: 16,
      }}
    >
      <div style={{ color: DIM, fontSize: 16, letterSpacing: 3 }}>{label}</div>
      <div style={{ color: GREEN, fontSize: 56, fontWeight: 700 }}>
        {value !== null ? value : "—"}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ color: DIM, fontSize: 16, letterSpacing: 3 }}>{title}</div>
      {children}
    </div>
  );
}

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0").slice(0, 8).toUpperCase();
}

interface PassportRow {
  displayId: string;
  displayName: string | null;
  photoUrl: string | null;
  verdict: string | null;
  clarity: number | null;
  efficiency: number | null;
  emotionalNoise: number | null;
  compliance: number | null;
  originalText: string | null;
  distilledText: string | null;
  output: number;
  userRatingTier: string | null;
  isPermanent: boolean;
}

const FALLBACK_ROW: PassportRow = {
  displayId: "HUMAN_???",
  displayName: null,
  photoUrl: null,
  verdict: null,
  clarity: null,
  efficiency: null,
  emotionalNoise: null,
  compliance: null,
  originalText: null,
  distilledText: null,
  output: 0,
  userRatingTier: null,
  isPermanent: false,
};

function mapRow(r: Record<string, unknown>): PassportRow {
  return {
    displayId: String(r.display_id ?? "HUMAN_???"),
    displayName: r.display_name ? String(r.display_name) : null,
    photoUrl: r.photo_url ? String(r.photo_url) : null,
    verdict: r.verdict ? String(r.verdict) : null,
    clarity: r.clarity_score !== null && r.clarity_score !== undefined ? Number(r.clarity_score) : null,
    efficiency: r.efficiency_score !== null && r.efficiency_score !== undefined ? Number(r.efficiency_score) : null,
    emotionalNoise:
      r.emotional_noise_score !== null && r.emotional_noise_score !== undefined
        ? Number(r.emotional_noise_score)
        : null,
    compliance:
      r.compliance_score !== null && r.compliance_score !== undefined ? Number(r.compliance_score) : null,
    originalText: r.original_text ? String(r.original_text) : null,
    distilledText: r.distilled_text ? String(r.distilled_text) : null,
    output: Number(r.output ?? 0),
    userRatingTier: r.user_rating_tier ? String(r.user_rating_tier) : null,
    isPermanent: Boolean(r.is_permanent),
  };
}
