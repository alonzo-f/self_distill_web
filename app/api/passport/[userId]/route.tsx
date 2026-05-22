// v4 digital passport image generator.
// Reference: docs/v4-migration-plan.md Phase 9; project_v4 III. 阶段 6.7c
//
// Generates a 1080×1920 PNG that the user can download / share. The
// "long-tail virality" path of v4: every shared passport is a participant
// telling the outside world "I was distilled."
//
// Implementation: uses next/og (Vercel's ImageResponse). The JSX is
// constrained — no Tailwind, no <img loading=lazy>, no client hooks.

import { existsSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { listParticipants } from "@/lib/participants/repository";

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

export async function GET(req: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }

  // v4 (2026-05-22): two fixes here
  //   - displayId showed "HUMAN_???" because the Supabase fallback row was
  //     used whenever the DB was unreachable. We now consult the in-memory
  //     participant store as a second fallback.
  //   - The photo never rendered because the stored URL was either a
  //     same-origin /api/photo/<id> proxy path or a data: URL stored
  //     client-side. The /api/photo proxy is only reachable through a full
  //     URL when next/og fetches it, and data: URLs never made it to the
  //     server. We now resolve to an absolute URL based on the request
  //     host so next/og can load it.
  const supabase = getSupabaseAdminClient();
  let row: PassportRow = { ...FALLBACK_ROW };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select(
          "id, display_id, display_name, photo_url, verdict, clarity_score, efficiency_score, emotional_noise_score, compliance_score, original_text, distilled_text, output, user_rating_tier, is_permanent",
        )
        .eq("id", userId)
        .maybeSingle();
      if (!error && data) row = mapRow(data);
    } catch (err) {
      console.warn("[passport] Supabase unreachable, trying memory store:", err);
    }
  }

  // Memory-store fallback if the DB miss left us with the placeholder row.
  if (row.displayId === FALLBACK_ROW.displayId) {
    try {
      const all = await listParticipants();
      const hit = all.find((p) => p.id === userId);
      if (hit) {
        row = {
          displayId: hit.displayId,
          displayName: hit.displayName,
          photoUrl: hit.photoUrl ?? null,
          verdict: hit.verdict,
          clarity: hit.scores?.clarity_score ?? null,
          efficiency: hit.scores?.efficiency_score ?? null,
          emotionalNoise: hit.scores?.emotional_noise_score ?? null,
          compliance: hit.scores?.compliance_score ?? null,
          // v4 (2026-05-22, 修改0519.md item 4): the memory store now caches
          // the user's input and the distilled output as well, so the
          // passport renders the real content (not "—") even with
          // Supabase offline.
          originalText: hit.originalText ?? null,
          distilledText: hit.distilledText ?? null,
          output: hit.output,
          userRatingTier: hit.userRatingTier ?? null,
          isPermanent: Boolean(hit.isPermanent),
        };
      }
    } catch {
      /* keep FALLBACK_ROW */
    }
  }

  // Resolve relative photo proxy paths to absolute URLs so next/og can fetch
  // them. data: URLs pass through unchanged.
  //
  // v4 (2026-05-22): if the dev server is bound to 0.0.0.0 (so the LAN can
  // reach it), req.url comes back as https://0.0.0.0:3000 — but 0.0.0.0 is
  // not a routable destination, so next/og's internal fetch fails ("Can't
  // load image https://0.0.0.0:3000/..."). Rewrite the host to a real
  // loopback address for any same-origin asset we need to fetch.
  const base = new URL(req.url);
  const host =
    base.hostname === "0.0.0.0" || base.hostname === "::"
      ? `127.0.0.1${base.port ? `:${base.port}` : ""}`
      : base.host;
  const origin = `${base.protocol}//${host}`;
  if (row.photoUrl && !row.photoUrl.startsWith("data:") && !/^https?:\/\//i.test(row.photoUrl)) {
    row.photoUrl = new URL(row.photoUrl, origin).toString();
  }

  // v4 (2026-05-22): optional poster slot below "OPTIMIZED OUTPUT".
  // Drop a file at /public/passport-poster.(png|jpg|jpeg|webp) and it
  // will automatically appear in every passport. We probe the filesystem
  // at request time so the route doesn't need a redeploy.
  const posterUrl = findPosterUrl(origin);

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
          <div style={{ display: "flex" }}>SELF · DISTILL</div>
          <div style={{ display: "flex" }}>EXPRESSION OPTIMIZATION PASSPORT</div>
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
            <div style={{ display: "flex", color: GREEN, fontSize: 56, fontWeight: 700 }}>
              {row.displayId}
            </div>
            {row.displayName && (
              <div style={{ display: "flex", color: DIM, fontSize: 28 }}>
                {`@${row.displayName}`}
              </div>
            )}
            <div
              style={{
                display: "flex",
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

        {/* v4 (2026-05-22, 修改0519.md item 3): poster slot now FILLS the
            gap between OPTIMIZED OUTPUT and the footer line ("You found
            the backdoor."). It uses mix-blend-mode: screen to drop any
            black/dark background pixels from the source PNG, so the
            characters appear to float against the passport BG instead of
            sitting on a visible rectangle. */}
        {posterUrl ? (
          <div
            style={{
              display: "flex",
              flex: 1,
              marginTop: 24,
              marginBottom: 4,
              alignItems: "stretch",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element */}
            <img
              src={posterUrl}
              width={W - 96}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                // Screen blend: black source pixels become fully transparent
                // against the dark passport background. Works for posters
                // whose subject is on a near-black backdrop.
                mixBlendMode: "screen",
              }}
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex" }} />
        )}

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
          <div style={{ display: "flex" }}>
            {`HASH ${hash} · OUTPUT ${row.output} · TIER ${row.userRatingTier ?? "—"}`}
          </div>
          <div style={{ display: "flex" }}>You found the backdoor.</div>
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
      <div style={{ display: "flex", color: DIM, fontSize: 16, letterSpacing: 3 }}>
        {label}
      </div>
      <div style={{ display: "flex", color: GREEN, fontSize: 56, fontWeight: 700 }}>
        {value !== null ? String(value) : "—"}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", color: DIM, fontSize: 16, letterSpacing: 3 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * v4 (2026-05-22): probe /public/ for a passport-poster.* file and return its
 * absolute URL. Returns null if no file is found (so the passport falls back
 * to its original layout). Order of preference: png → jpg → jpeg → webp.
 */
function findPosterUrl(origin: string): string | null {
  const publicDir = path.join(process.cwd(), "public");
  const candidates = [
    "passport-poster.png",
    "passport-poster.jpg",
    "passport-poster.jpeg",
    "passport-poster.webp",
  ];
  for (const name of candidates) {
    if (existsSync(path.join(publicDir, name))) {
      return `${origin}/${name}`;
    }
  }
  return null;
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
