"use client";

// v4 (2026-05-22): post-experience email capture.
// Reference: 修改0519.md item 3
//
// Two embed points:
//   - /leisure/settlement (graveyard path)
//   - /backdoor          (full-flow / "you found the backdoor" path)
//
// Behaviour:
//   - Validates an RFC-ish email shape client-side (kept loose on purpose).
//   - Writes to Zustand store immediately so it survives navigation.
//   - Best-effort POST /api/participants { email } — memory store handles
//     it locally when Supabase isn't reachable.
//   - After successful submit the component collapses to a confirmation.

import { useState } from "react";
import { useParticipantStore } from "@/stores/participant-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailCaptureProps {
  /**
   * Copy tweak per surface. The settlement (graveyard) variant uses amber to
   * fit the archive aesthetic; the backdoor variant uses green to feel like
   * a "system reward" rather than a "farewell".
   */
  variant: "graveyard" | "backdoor";
}

export function EmailCapture({ variant }: EmailCaptureProps) {
  const store = useParticipantStore();
  const [email, setEmail] = useState(store.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(store.email));
  const [error, setError] = useState<string | null>(null);

  const valid = EMAIL_RE.test(email.trim());

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setError(null);
    setSubmitting(true);
    const clean = email.trim();

    // Local first
    store.setParticipant({ email: clean });

    // Best-effort persist
    if (store.id) {
      try {
        await fetch("/api/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: store.id,
            displayId: store.displayId,
            email: clean,
          }),
        });
      } catch {
        /* non-fatal — already saved locally */
      }
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  const isGraveyard = variant === "graveyard";
  const accent = isGraveyard ? "amber" : "green";
  const labelText = isGraveyard
    ? "LEAVE YOUR EMAIL (optional)"
    : "STAY IN TOUCH (optional)";
  const helperText = isGraveyard
    ? "We'll send you a short follow-up about the archive — and a postcard from the foundation."
    : "We'll send you a follow-up note: how the foundation grew, and where the next ceremony will be.";

  if (submitted) {
    return (
      <div
        className={`border ${
          isGraveyard
            ? "border-terminal-amber/40 bg-terminal-amber/5"
            : "border-terminal-green/40 bg-terminal-green/5"
        } p-3 text-[11px] text-terminal-dim leading-relaxed`}
      >
        <span className={isGraveyard ? "text-terminal-amber" : "text-terminal-green"}>
          ✓ {store.email}
        </span>{" "}
        — saved. You&apos;ll hear from us.
      </div>
    );
  }

  return (
    <div
      className={`border ${
        isGraveyard
          ? "border-terminal-amber/40"
          : "border-terminal-green/40"
      } p-3 space-y-2`}
    >
      <div
        className={`text-[10px] tracking-widest ${
          isGraveyard ? "text-terminal-amber" : "text-terminal-green"
        }`}
      >
        {labelText}
      </div>
      <div className="text-[11px] text-terminal-dim leading-snug">
        {helperText}
      </div>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@somewhere.com"
        className={`w-full bg-black border border-terminal-border text-terminal-text px-3 py-2 text-sm focus:outline-none ${
          isGraveyard
            ? "focus:border-terminal-amber"
            : "focus:border-terminal-green"
        }`}
        disabled={submitting}
      />
      {error && <div className="text-terminal-red text-[10px]">{error}</div>}
      <button
        onClick={handleSubmit}
        disabled={!valid || submitting}
        className={`w-full border px-4 py-2 text-xs transition-colors ${
          valid && !submitting
            ? isGraveyard
              ? "border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10"
              : "border-terminal-green text-terminal-green hover:bg-terminal-green/10"
            : "border-terminal-border text-terminal-dim cursor-not-allowed"
        }`}
      >
        {submitting ? "Saving..." : `Send me a follow-up (${accent === "amber" ? "▾" : "✉"})`}
      </button>
    </div>
  );
}
