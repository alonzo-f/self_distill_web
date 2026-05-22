import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

/**
 * v4 (2026-05-22): circuit breaker for unreachable Supabase. When any
 * caller observes ECONNREFUSED / timeout, it calls markSupabaseDown().
 * For the next CIRCUIT_TTL_MS we skip Supabase entirely and report
 * `getSupabaseAdminClient()` as null — callers fall through to their
 * in-memory paths instantly instead of waiting ~7s on every request.
 *
 * The breaker self-heals after the TTL, so if you start Docker mid-session
 * the next call simply tries again.
 */
const CIRCUIT_TTL_MS = 30_000;
let supabaseDownUntil = 0;

export function markSupabaseDown() {
  supabaseDownUntil = Date.now() + CIRCUIT_TTL_MS;
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseAdminClient() {
  if (!isSupabaseConfigured()) return null;
  if (Date.now() < supabaseDownUntil) return null;

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return cachedAdminClient;
}
