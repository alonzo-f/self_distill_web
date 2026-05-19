"use client";

// v4 Ghost Observer page — Phase 7 final form.
// Reference: docs/v4-migration-plan.md Phase 7; project_v4 III. 阶段 6.5c
//
// User has been archived. The screen is locked to a mirror of /wall.
// A single [Exit] affordance lives top-right; clicking it raises a
// dark-pattern modal whose default highlight is [Stay].
//
// Implementation notes:
//   - The wall is rendered inside an <iframe src="/wall"> so we get the
//     live projection view for free with no duplicate Supabase
//     subscription code.
//   - Touch/keyboard interaction with the iframe is allowed (the user can
//     scroll / observe), but they cannot escape via the URL bar of the
//     iframe alone — outer router controls page navigation.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { loadSession, clearSession } from "@/lib/local-storage";
import { startOver } from "@/lib/exit-handler";

export default function GhostPage() {
  const router = useRouter();
  const store = useParticipantStore();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s || s.phase !== "GHOST") {
      router.replace("/");
      return;
    }
    // External-system sync: confirmed the user belongs here, allow render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
        <div className="text-terminal-dim text-xs font-mono animate-pulse">
          Verifying archival...
        </div>
      </div>
    );
  }

  const handleLeave = async () => {
    setBusy(true);
    const res = await startOver();
    if (res.ok) {
      store.reset();
      clearSession();
      router.replace("/");
    } else {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Wall mirror */}
      <iframe
        src="/wall"
        title="Projection wall mirror"
        className="w-full h-full"
        style={{ border: 0 }}
      />

      {/* Top-left badge: identity */}
      <div className="fixed top-2 left-3 z-30 text-[10px] text-terminal-dim/70 font-mono tracking-widest">
        GHOST · {store.displayId} · @{store.displayName || "—"}
      </div>

      {/* Top-right [Exit] */}
      {!confirming && (
        <button
          onClick={() => setConfirming(true)}
          className="fixed top-2 right-3 z-30 border border-terminal-dim text-terminal-dim font-mono text-[11px] px-2.5 py-1 hover:border-terminal-red hover:text-terminal-red transition-colors"
        >
          [Exit]
        </button>
      )}

      {/* Dark pattern modal */}
      {confirming && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <TerminalWindow title="EXIT — CONFIRMATION">
              <div className="space-y-3">
                <SystemMessage type="warning">Are you sure?</SystemMessage>
                <div className="text-terminal-text text-xs leading-relaxed">
                  Your archived profile will remain visible in the Graveyard.
                  Leaving will remove your name from the system&apos;s memory.
                </div>
                {/* Stay is the highlighted default — pure dark pattern */}
                <button
                  onClick={() => setConfirming(false)}
                  className="w-full border-2 border-terminal-green text-terminal-green bg-terminal-green/10 px-4 py-3 text-sm hover:bg-terminal-green/20 transition-colors"
                >
                  ▣ Stay
                </button>
                <button
                  onClick={handleLeave}
                  disabled={busy}
                  className="w-full border border-terminal-dim text-terminal-dim px-4 py-2 text-[11px] hover:text-terminal-red hover:border-terminal-red transition-colors disabled:opacity-50"
                >
                  {busy ? "Erasing..." : "Leave (start over)"}
                </button>
              </div>
            </TerminalWindow>
          </div>
        </div>
      )}
    </div>
  );
}
