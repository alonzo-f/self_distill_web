"use client";

// v4 Ghost Observer landing — Phase 6 stub.
// Reference: docs/v4-migration-plan.md Phase 7; project_v4 III. 阶段 6.5c
//
// Phase 7 will replace this stub with:
//   - the pixel-tomb animation playback (deferred from settlement)
//   - the full /wall mirror in a locked iframe
//   - the dark-pattern [Exit] / [Stay] modal
//
// For Phase 6 we just gate the route so a GHOST user lands somewhere
// coherent. The Stay/Leave choice is mocked.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { loadSession } from "@/lib/local-storage";
import { startOver } from "@/lib/exit-handler";
import { clearSession } from "@/lib/local-storage";

export default function GhostPage() {
  const router = useRouter();
  const store = useParticipantStore();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s || s.phase !== "GHOST") {
      router.replace("/");
    }
  }, [router]);

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-terminal-bg">
      <div className="w-full max-w-md">
        <TerminalWindow title="GHOST OBSERVER">
          <div className="space-y-4">
            <SystemMessage type="warning">
              {store.displayId} — ARCHIVED
            </SystemMessage>
            <div className="text-terminal-dim text-xs leading-relaxed">
              You have been processed. From here you may continue to observe
              the system without participating.
            </div>

            {/* Phase 8 will mount the actual <Wall /> mirror inline here */}
            <div className="rounded-md border border-dashed border-terminal-dim/40 p-6 text-center text-terminal-dim/70 text-[11px] italic">
              [projection-wall mirror — coming with Phase 8]
            </div>

            <a
              href="/wall"
              className="block w-full border border-terminal-green text-terminal-green text-center px-4 py-2 text-xs hover:bg-terminal-green/10 transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              Open Wall (new tab) ↗
            </a>

            {!confirmingLeave ? (
              <button
                onClick={() => setConfirmingLeave(true)}
                className="w-full border border-terminal-dim text-terminal-dim px-4 py-2 text-[11px] hover:text-terminal-red hover:border-terminal-red transition-colors"
              >
                [Exit]
              </button>
            ) : (
              <div className="space-y-2 border-t border-terminal-border/40 pt-3">
                <div className="text-terminal-text text-xs leading-relaxed">
                  Are you sure? Your archived profile will remain visible in
                  the Graveyard. Leaving will remove your name from the
                  system&apos;s memory.
                </div>
                <button
                  onClick={() => setConfirmingLeave(false)}
                  className="w-full border border-terminal-green text-terminal-green px-4 py-2 text-xs hover:bg-terminal-green/10 transition-colors"
                >
                  ▣ Stay
                </button>
                <button
                  onClick={handleLeave}
                  disabled={busy}
                  className="w-full border border-terminal-red text-terminal-red px-4 py-2 text-[11px] hover:bg-terminal-red/10 transition-colors disabled:opacity-50"
                >
                  {busy ? "Erasing..." : "Leave (start over)"}
                </button>
              </div>
            )}
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
