"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  TerminalWindow,
  TerminalText,
  SystemMessage,
  GlitchText,
} from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { determineVerdict } from "@/lib/score-transform";
import { RouteGuard } from "@/components/RouteGuard";
import { DistillationAnimation } from "@/components/DistillationAnimation";
import { loadSession, saveSession, advancePhase } from "@/lib/local-storage";

type Phase = "analyzing" | "reveal";

export default function VerdictPage() {
  return (
    <RouteGuard>
      <VerdictContent />
    </RouteGuard>
  );
}

function VerdictContent() {
  const router = useRouter();
  const store = useParticipantStore();
  const [phase, setPhase] = useState<Phase>("analyzing");

  const scores = store.scores;
  const photoUrl = store.photoUrl;
  const setVerdict = store.setVerdict;
  const setStatus = store.setStatus;
  const verdict = scores ? determineVerdict(scores) : "VESSEL_PRESERVED";
  const isDistilled = verdict === "DISTILLED";

  useEffect(() => {
    if (!scores) return;
    setVerdict(verdict);
    setStatus("BENCHMARKED");
    const timer = setTimeout(() => setPhase("reveal"), 3500);
    return () => clearTimeout(timer);
  }, [scores, setStatus, setVerdict, verdict]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {phase === "analyzing" && (
          <TerminalWindow title="VERDICT PENDING">
            <div className="space-y-3">
              <SystemMessage type="system">
                Computing distillation viability...
              </SystemMessage>
              <div className="space-y-1">
                <TerminalText
                  text="> Cross-referencing clarity metrics..."
                  speed={25}
                  className="text-terminal-green text-xs block"
                />
                <TerminalText
                  text="> Evaluating emotional noise tolerance..."
                  speed={25}
                  delay={800}
                  className="text-terminal-green text-xs block"
                />
                <TerminalText
                  text="> Determining system classification..."
                  speed={25}
                  delay={1600}
                  className="text-terminal-amber text-xs block"
                />
              </div>
              <div className="text-center mt-6">
                <div className="inline-block w-8 h-8 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          </TerminalWindow>
        )}

        {phase === "reveal" && (
          <div className="space-y-4">
            <TerminalWindow
              title="DISTILLATION VERDICT"
              variant={isDistilled ? "success" : "warning"}
            >
              <div className="text-center space-y-6 py-4">
                {/* Verdict */}
                <div>
                  <GlitchText
                    text={isDistilled ? "DISTILLED" : "VESSEL PRESERVED"}
                    className={`text-3xl font-bold ${
                      isDistilled
                        ? "text-terminal-green"
                        : "text-terminal-amber"
                    }`}
                  />
                </div>

                {/* Photo / Avatar */}
                <div className="flex justify-center">
                  {isDistilled ? (
                    // v4: animated particle lattice replaces the static hex.
                    // Photo dissolves → 64 green dots reorganize into 8×8 grid.
                    <DistillationAnimation
                      photoUrl={photoUrl}
                      onComplete={() => {
                        /* animation finishes silently; verdict copy stays. */
                      }}
                    />
                  ) : (
                    photoUrl && (
                      <div className="relative w-32 h-32 border-2 border-terminal-amber overflow-hidden">
                        <Image
                          src={photoUrl}
                          alt="profile"
                          width={128}
                          height={128}
                          unoptimized
                          className="w-full h-full object-cover"
                          style={{ transform: "scaleX(-1)" }}
                        />
                      </div>
                    )
                  )}
                </div>

                {/* Explanation */}
                <div className="text-sm space-y-2 max-w-sm mx-auto">
                  {isDistilled ? (
                    <>
                      <SystemMessage type="system">
                        Your expression has been successfully distilled.
                      </SystemMessage>
                      <p className="text-terminal-dim text-xs mt-2">
                        Your communication patterns can be compressed into an
                        algorithm. An optimized version of you now exists in the
                        system.
                      </p>
                    </>
                  ) : (
                    <>
                      <SystemMessage type="warning">
                        Distillation failed — emotional noise too high.
                      </SystemMessage>
                      <p className="text-terminal-dim text-xs mt-2">
                        Your expression contains too much irreducible complexity.
                        The system cannot fully optimize you. Your original
                        vessel is preserved.
                      </p>
                    </>
                  )}
                </div>

                {/* Subtext */}
                <p className="text-terminal-dim text-[10px] italic">
                  {isDistilled
                    ? "You are replaceable."
                    : "You are inefficient."}
                </p>
              </div>
            </TerminalWindow>

            <button
              onClick={() => {
                // v4: viewing verdict completes the main line.
                // Advance phase to HUB_UNLOCKED and send the user to /hub
                // so they can choose their next destination freely.
                const persisted = loadSession();
                if (persisted) {
                  saveSession(advancePhase(persisted, "HUB_UNLOCKED"));
                }
                store.setPhase("HUB_UNLOCKED");
                router.push("/hub");
              }}
              className="w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
            >
              Enter Hub →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
