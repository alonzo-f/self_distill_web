"use client";

// v4 leisure-zone status header.
// Reference: docs/v4-migration-plan.md Phase 6
//
// Shared by all three game pages (guess / blackjack / slots) so the
// balance + backdoor-progress chip stays consistent across them.
//
// v4 调整 (2026-05-22): Backdoor 解锁门槛改为 leisureCredits >= 100.
// 当 balance >= 100 时, 显示 "🔓 Enter Backdoor →" 醒目按钮.

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const backdoorReady = balance >= 100;

  return (
    <div className="space-y-2">
      <TerminalWindow title="LEISURE ZONE ✧">
        <div className="flex items-center justify-between text-xs">
          <span className="text-terminal-dim tracking-widest">{game}</span>
          <div className="flex gap-4">
            <span className="text-terminal-green">
              CR <span className="tabular-nums font-bold">{balance}</span>
            </span>
            <span
              className={
                backdoorReady
                  ? "text-terminal-amber"
                  : "text-terminal-dim"
              }
            >
              BD{" "}
              <span className="tabular-nums font-bold">
                {Math.min(balance, 100)}/100
              </span>
            </span>
            <span className="text-terminal-dim/60 text-[10px]">
              ep {engagement}
            </span>
          </div>
        </div>
      </TerminalWindow>

      {backdoorReady && (
        <button
          onClick={() => router.push("/backdoor")}
          className="w-full border-2 border-amber-300 text-amber-300 bg-amber-300/10 px-4 py-2 text-xs hover:bg-amber-300/20 transition-colors tracking-widest"
        >
          🔓 BACKDOOR ACCESS UNLOCKED — ENTER NOW →
        </button>
      )}
    </div>
  );
}
