"use client";

// v4 backdoor entry — the fusion ceremony + opt-in foundation naming.
// Reference: docs/v4-migration-plan.md Phase 9; project_v4 III. 阶段 6.7
//
// Gated by leisureCredits >= 100 (Hub link is Locked otherwise).
// Flow:
//   1. BackdoorAnimation auto-plays (~3.5s) → photo dissolves into Builder cluster
//   2. Hard-coded text reveal: "You found the backdoor. But the backdoor was a door..."
//   3. Optional naming form — writes is_permanent=true on the participant row
//   4. Phase advances to BACKDOOR_FOUND; attack tokens (3) confirmed via store
//   5. Buttons: [Download Digital Passport] / [Use Attack Tokens] / [Back to Hub]

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { RouteGuard } from "@/components/RouteGuard";
import { HubButton } from "@/components/HubButton";
import { BackdoorAnimation } from "@/components/BackdoorAnimation";
import {
  loadSession,
  saveSession,
  advancePhase,
} from "@/lib/local-storage";

const BUILDERS = [
  { id: "BUILDER_01", role: "编剧/导演" },
  { id: "BUILDER_02", role: "程序员" },
];

export default function BackdoorPage() {
  return (
    <RouteGuard>
      <HubButton />
      <BackdoorContent />
    </RouteGuard>
  );
}

function BackdoorContent() {
  const router = useRouter();
  const store = useParticipantStore();
  const [animationDone, setAnimationDone] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [foundationName, setFoundationName] = useState("");
  const [naming, setNaming] = useState(false);
  const [committed, setCommitted] = useState(false);

  // Gate: must have >= 100 engagement
  useEffect(() => {
    // v4 调整: gate 改用 leisureCredits >= 100 (与 Hub 一致)
    if (store.leisureCredits < 100 && !store.backendUnlocked) {
      router.replace("/hub");
    }
  }, [store.leisureCredits, store.backendUnlocked, router]);

  // On animation complete, commit BACKDOOR_FOUND + grant attack tokens
  const commitBackdoorPhase = async () => {
    if (committed || committing) return;
    setCommitting(true);

    // Make sure the store has 3 tokens (Phase 0 store already auto-grants on unlockBackend)
    store.unlockBackend();

    // Persist phase to localStorage + Zustand
    const persisted = loadSession();
    if (persisted) {
      saveSession(advancePhase(persisted, "BACKDOOR_FOUND"));
    }
    store.setPhase("BACKDOOR_FOUND");

    // Server side: bump phase + attack_tokens + backend_unlocked
    if (store.id) {
      try {
        await fetch("/api/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: store.id,
            displayId: store.displayId,
            displayName: store.displayName || null,
            phase: "BACKDOOR_FOUND",
            attackTokens: 3,
            backendUnlocked: true,
          }),
        });
      } catch {
        /* non-fatal */
      }
    }

    setCommitted(true);
    setCommitting(false);
  };

  const submitFoundationName = async () => {
    if (!foundationName.trim()) return;
    setNaming(true);
    // Update displayName + set is_permanent
    if (store.id) {
      try {
        await fetch("/api/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: store.id,
            displayId: store.displayId,
            displayName: foundationName.trim(),
            isPermanent: true,
          }),
        });
      } catch {
        /* non-fatal */
      }
    }
    store.setParticipant({
      displayName: foundationName.trim(),
      isPermanent: true,
    });
    setNaming(false);
  };

  const handleAnimationComplete = () => {
    setAnimationDone(true);
    void commitBackdoorPhase();
  };

  const downloadPassport = () => {
    if (!store.id) return;
    window.open(`/api/passport/${store.id}`, "_blank");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TerminalWindow title="BACKDOOR ACCESS GRANTED">
          <div className="space-y-4">
            <SystemMessage type="system">
              You have reached the core of the system.
            </SystemMessage>

            <BackdoorAnimation
              photoUrl={store.photoUrl}
              builderRoles={BUILDERS}
              onComplete={handleAnimationComplete}
            />

            {animationDone && (
              <>
                {/* Foundation naming */}
                {!store.isPermanent ? (
                  <div className="space-y-2 border border-terminal-amber/40 p-3">
                    <div className="text-terminal-amber text-[11px] tracking-widest">
                      LEAVE YOUR MARK (optional)
                    </div>
                    <input
                      type="text"
                      value={foundationName}
                      onChange={(e) => setFoundationName(e.target.value)}
                      maxLength={20}
                      placeholder={store.displayName || "Your name for the foundation"}
                      className="w-full bg-black border border-terminal-border text-terminal-text px-3 py-2 text-sm focus:outline-none focus:border-terminal-amber"
                    />
                    <button
                      onClick={submitFoundationName}
                      disabled={!foundationName.trim() || naming}
                      className="w-full border border-terminal-amber text-terminal-amber px-4 py-2 text-xs hover:bg-terminal-amber/10 transition-colors disabled:opacity-40"
                    >
                      {naming ? "Carving..." : "Add to foundation ▾"}
                    </button>
                  </div>
                ) : (
                  <SystemMessage type="info">
                    @{store.displayName} added to the foundation. The graveyard
                    has you now.
                  </SystemMessage>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-terminal-border/40">
                  <button
                    onClick={downloadPassport}
                    className="w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
                  >
                    ▾ Download Digital Passport
                  </button>
                  <button
                    onClick={() => router.push("/backdoor/attack")}
                    className="w-full border border-terminal-red text-terminal-red px-4 py-3 text-sm hover:bg-terminal-red/10 transition-colors"
                  >
                    ⚔ Use Attack Tokens ({store.attackTokens})
                  </button>
                  <button
                    onClick={() => router.push("/hub")}
                    className="w-full border border-terminal-dim text-terminal-dim px-4 py-2 text-[11px] hover:text-terminal-text hover:border-terminal-text transition-colors"
                  >
                    ← Back to Hub
                  </button>
                </div>
              </>
            )}
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
