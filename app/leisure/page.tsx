"use client";

// v4 leisure dispatcher.
// Reference: docs/v4-migration-plan.md Phase 6; project_v4 III. 阶段 6.5
//
// Entry gate (v4 调整, 用户需求):
//   - miningCredits < 50 → 显示锁屏, 引导回 /mine 继续生产
//   - miningCredits ≥ 50 → 分配游戏, 同步 leisureCredits, 路由到子游戏
//
// On first qualifying entry:
//   - allocate a game based on compliance score
//   - sync leisureCredits ← miningCredits (the "你的努力变成了你的赌资" moment)
// Then redirect to the game-specific route.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import { RouteGuard } from "@/components/RouteGuard";
import { HubButton } from "@/components/HubButton";
import { allocateGame, GAME_ROUTES } from "@/lib/leisure-allocator";
import { playLeisureUnlockSfx, unlockAudio } from "@/lib/audio/eight-bit";

const LEISURE_UNLOCK_THRESHOLD = 50;

export default function LeisurePage() {
  return (
    <RouteGuard>
      <HubButton />
      <LeisureDispatcher />
    </RouteGuard>
  );
}

function LeisureDispatcher() {
  const router = useRouter();
  const store = useParticipantStore();
  const [verdict, setVerdict] = useState<"checking" | "locked" | "redirecting">(
    "checking",
  );

  useEffect(() => {
    // Allow re-entry to an already-allocated session even if mining_credits
    // has dropped below the threshold meanwhile (user already paid the gate).
    const alreadyAllocated = !!store.leisureGame && store.leisureCredits > 0;
    if (
      !alreadyAllocated &&
      store.miningCredits < LEISURE_UNLOCK_THRESHOLD
    ) {
      // External-system sync: store → React state, one-shot on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVerdict("locked");
      return;
    }

    const compliance = store.scores?.compliance ?? 50;
    const game = store.leisureGame ?? allocateGame(compliance);
    const initialCredits =
      store.leisureCredits > 0 ? store.leisureCredits : store.miningCredits;

    if (!store.leisureGame) {
      store.setLeisureGame(game);
      // v4 (2026-05-22): first-entry audio cue. Only on the initial
      // allocation, not on re-entry.
      void unlockAudio();
      playLeisureUnlockSfx();
    }
    if (store.leisureCredits === 0 && store.miningCredits > 0) {
      store.setParticipant({ leisureCredits: initialCredits });
    }

    setVerdict("redirecting");
    router.replace(GAME_ROUTES[game]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (verdict === "locked") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-terminal-bg">
        <div className="w-full max-w-md">
          <TerminalWindow title="LEISURE ZONE · LOCKED">
            <div className="space-y-3">
              <SystemMessage type="warning">
                Insufficient credits to access Leisure Zone.
              </SystemMessage>
              <div className="text-terminal-text text-xs leading-relaxed">
                Leisure access requires{" "}
                <span className="text-terminal-amber font-bold">
                  {LEISURE_UNLOCK_THRESHOLD} credits
                </span>{" "}
                of verified production output. Your current balance is{" "}
                <span className="text-terminal-green font-bold tabular-nums">
                  {store.miningCredits}
                </span>
                .
              </div>
              <div className="text-terminal-dim text-[11px] leading-relaxed italic">
                Return to the Production System and meet the threshold to
                unlock recreational facilities.
              </div>
              <button
                onClick={() => router.push("/mine")}
                className="w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
              >
                ▣ Return to Production
              </button>
              <button
                onClick={() => router.push("/hub")}
                className="w-full border border-terminal-dim text-terminal-dim text-[11px] py-2 hover:text-terminal-text hover:border-terminal-text transition-colors"
              >
                ← Back to Hub
              </button>
            </div>
          </TerminalWindow>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
      <div className="text-terminal-dim text-xs font-mono animate-pulse">
        {verdict === "redirecting" ? "Allocating leisure profile..." : "Verifying access..."}
      </div>
    </div>
  );
}
