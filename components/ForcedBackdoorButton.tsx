"use client";

// v4 (2026-05-22, 修改0519.md item 2): once a participant's leisure
// balance crosses 100, betting is locked and this button becomes their
// only remaining valid action. Used by all three leisure games (guess,
// blackjack, slots) — rendered directly below the AUTO action.

import { useRouter } from "next/navigation";

export function ForcedBackdoorButton({ visible }: { visible: boolean }) {
  const router = useRouter();
  if (!visible) return null;
  return (
    <button
      onClick={() => router.push("/backdoor")}
      className="w-full mt-2 py-3 rounded-md border-2 border-amber-300 bg-amber-300/10 text-amber-300 hover:bg-amber-300/20 transition-colors text-sm font-bold tracking-widest animate-pulse"
    >
      🔓 BACKDOOR UNLOCKED — ENTER NOW →
    </button>
  );
}
