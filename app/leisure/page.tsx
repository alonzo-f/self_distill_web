"use client";

// v4 leisure dispatcher.
// Reference: docs/v4-migration-plan.md Phase 6; project_v4 III. 阶段 6.5
//
// On first entry:
//   - allocate a game based on compliance score
//   - sync leisureCredits ← miningCredits (the "你的努力变成了你的赌资" moment)
// Then redirect to the game-specific route.
//
// If already allocated, redirect immediately.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParticipantStore } from "@/stores/participant-store";
import { RouteGuard } from "@/components/RouteGuard";
import { HubButton } from "@/components/HubButton";
import { allocateGame, GAME_ROUTES } from "@/lib/leisure-allocator";

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

  useEffect(() => {
    const compliance = store.scores?.compliance ?? 50;
    const game = store.leisureGame ?? allocateGame(compliance);

    // Initialize leisure credits from mining credits on first entry only.
    // (leisureCredits is 0 by default in v4 — anything > 0 means we've started.)
    const initialCredits =
      store.leisureCredits > 0 ? store.leisureCredits : store.miningCredits;

    if (!store.leisureGame) {
      store.setLeisureGame(game);
    }
    if (store.leisureCredits === 0 && store.miningCredits > 0) {
      store.setParticipant({ leisureCredits: initialCredits });
    }

    router.replace(GAME_ROUTES[game]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
      <div className="text-terminal-dim text-xs font-mono animate-pulse">
        Allocating leisure profile...
      </div>
    </div>
  );
}
