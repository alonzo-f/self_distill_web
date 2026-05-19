"use client";

// v4 leisure-zone status header.
// Reference: docs/v4-migration-plan.md Phase 6
//
// Shared by all three game pages (guess / blackjack / slots) so the
// balance + engagement chip stays consistent across them.

import { TerminalWindow } from "@/components/terminal";

export function LeisureHeader({
  balance,
  engagement,
  game,
}: {
  balance: number;
  engagement: number;
  game: string;
}) {
  return (
    <TerminalWindow title="LEISURE ZONE ✧">
      <div className="flex items-center justify-between text-xs">
        <span className="text-terminal-dim tracking-widest">{game}</span>
        <div className="flex gap-4">
          <span className="text-terminal-green">
            CR <span className="tabular-nums font-bold">{balance}</span>
          </span>
          <span className="text-terminal-amber">
            EP <span className="tabular-nums font-bold">{engagement}/100</span>
          </span>
        </div>
      </div>
    </TerminalWindow>
  );
}
