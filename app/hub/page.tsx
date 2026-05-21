"use client";

// v4 Hub — central state overview + free-explore launchpad.
// Reference: docs/v4-migration-plan.md Phase 3; project_v4 III. 阶段 0.5
//
// Only accessible once phase >= BENCHMARKED (and phase != GHOST). The
// RouteGuard will bounce earlier users to their proper page.
//
// Hub responsibilities:
//   - show identity + verdict + credits + engagement points
//   - recommend the next stage of the experience
//   - offer free entry into Production / Leisure / Wall Mirror / Backdoor
//   - host the [Exit System] dark-pattern button (Start Over for eligible
//     users; Resume otherwise)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import {
  loadSession,
  clearSession,
  type PersistedSession,
} from "@/lib/local-storage";
import {
  canStartOver,
  isHubUnlocked,
} from "@/lib/state-machine";
import { startOver } from "@/lib/exit-handler";

interface ExploreOption {
  key: string;
  label: string;
  glyph: string;
  href: string;
  unlocked: boolean;
  locked_reason?: string;
}

export default function HubPage() {
  const router = useRouter();
  const store = useParticipantStore();
  const [session, setSession] = useState<PersistedSession | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load session + bounce ineligible users
  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
      return;
    }
    if (!isHubUnlocked(s.phase) && s.phase !== "BACKDOOR_FOUND") {
      router.replace("/");
      return;
    }
    // External-system sync: localStorage → React state. Legitimate use of
    // setState-in-effect, allowed by exception in the rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(s);
  }, [router]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
        <div className="text-terminal-dim text-xs font-mono animate-pulse">Loading hub...</div>
      </div>
    );
  }

  const engagement = store.engagementPoints;
  const credits = store.miningCredits;
  const leisureCredits = store.leisureCredits;
  const verdict = store.verdict ?? "PENDING";
  // v4 调整: backdoor 解锁条件改为 leisureCredits >= 100
  // (原来是 engagementPoints >= 100, 改为更可见的资源门槛)
  const backdoorUnlocked = store.backendUnlocked || leisureCredits >= 100;
  const operatorAvailable = store.operatorEligible;

  const options: ExploreOption[] = [
    {
      key: "verdict",
      label: "Verdict Reveal",
      glyph: "▤",
      href: "/verdict",
      unlocked: true,
    },
    {
      key: "mine",
      label: "Production System",
      glyph: "▣",
      href: "/mine",
      unlocked: true,
    },
    {
      key: "operate",
      label: "Operator Panel",
      glyph: "▲",
      href: "/operate",
      unlocked: operatorAvailable,
      locked_reason: "Not eligible",
    },
    {
      key: "leisure",
      label: "Leisure Zone",
      glyph: "☕",
      href: "/leisure",
      // v4 调整 (用户需求): credit ≥ 50 才解锁
      unlocked: credits >= 50 || store.leisureCredits > 0,
      locked_reason: `${credits}/50 credits`,
    },
    // v4 调整 (用户需求): Wall Mirror 入口对客户端隐藏,
    // 仅 GHOST 模式通过 iframe 镜像可见.
    {
      key: "backdoor",
      label: "Backdoor",
      glyph: "🔓",
      href: "/backdoor",
      unlocked: backdoorUnlocked,
      locked_reason: `${leisureCredits}/100 leisure credits`,
    },
  ];

  const recommended =
    !store.verdict
      ? options[0]                            // hasn't seen verdict yet
      : credits === 0
        ? options.find((o) => o.key === "mine")
        : options.find((o) => o.key === "leisure");

  const handleExitClick = () => setConfirmExit(true);

  const handleResume = () => {
    setConfirmExit(false);
    // No-op: user chose to stay. Browser tab remains on Hub.
  };

  const handleStartOver = async () => {
    if (!canStartOver(session.phase)) return;
    setBusy(true);
    const result = await startOver();
    if (result.ok) {
      store.reset();
      clearSession();
      router.replace("/");
    } else {
      setBusy(false);
      console.error(`Start Over failed: ${result.reason ?? "unknown"}`);
    }
  };

  if (confirmExit) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <TerminalWindow title="EXIT — CONFIRMATION">
            <div className="space-y-4">
              <SystemMessage type="warning">
                Are you sure?
              </SystemMessage>
              <div className="text-terminal-text text-xs leading-relaxed">
                Your archived profile will remain visible in the Graveyard once
                you have been processed. Leaving will remove your name from the
                system&apos;s memory.
              </div>
              <button
                onClick={handleResume}
                className="w-full border border-terminal-green text-terminal-green px-4 py-3 text-sm hover:bg-terminal-green/10 transition-colors"
              >
                ▣ Stay
              </button>
              {canStartOver(session.phase) ? (
                <button
                  onClick={handleStartOver}
                  disabled={busy}
                  className="w-full border border-terminal-red text-terminal-red px-4 py-3 text-xs hover:bg-terminal-red/10 transition-colors disabled:opacity-50"
                >
                  {busy ? "Erasing..." : "Leave (start over)"}
                </button>
              ) : (
                <div className="text-terminal-dim text-[10px] text-center">
                  Start Over is only available after the main line is complete.
                </div>
              )}
            </div>
          </TerminalWindow>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <TerminalWindow title="HUB — EXPRESSION OPTIMIZATION SYSTEM">
          <div className="space-y-4">
            {/* Identity row */}
            <div className="flex justify-between items-baseline">
              <div className="text-terminal-green text-sm font-bold">
                {session.displayId}
                {session.displayName && (
                  <span className="text-terminal-dim font-normal ml-2">— @{session.displayName}</span>
                )}
              </div>
              <div
                className={
                  verdict === "DISTILLED"
                    ? "text-terminal-green text-[10px]"
                    : verdict === "VESSEL_PRESERVED"
                      ? "text-terminal-amber text-[10px]"
                      : "text-terminal-dim text-[10px]"
                }
              >
                {verdict}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="border border-terminal-border p-2">
                <div className="text-terminal-dim text-[9px] tracking-widest">MINING CREDITS</div>
                <div className="text-terminal-green text-base tabular-nums">{credits}</div>
                <div className="text-terminal-dim text-[8px] mt-0.5">
                  {credits >= 50 ? "Leisure unlocked" : `${credits}/50 → Leisure`}
                </div>
              </div>
              <div className="border border-terminal-border p-2">
                <div className="text-terminal-dim text-[9px] tracking-widest">LEISURE CREDITS</div>
                <div className="text-terminal-green text-base tabular-nums">{leisureCredits}</div>
                <div className="text-terminal-dim text-[8px] mt-0.5">
                  {backdoorUnlocked ? "Backdoor unlocked" : `${leisureCredits}/100 → Backdoor`}
                </div>
              </div>
            </div>
            <div className="text-terminal-dim/60 text-[9px] text-right">
              engagement: {engagement}/100
            </div>

            {/* Recommended next */}
            {recommended && (
              <div className="border border-terminal-amber/40 bg-terminal-amber/5 p-3">
                <div className="text-terminal-dim text-[9px] tracking-widest mb-1">
                  RECOMMENDED NEXT
                </div>
                <button
                  onClick={() => router.push(recommended.href)}
                  className="w-full text-left text-terminal-amber text-sm hover:text-terminal-green transition-colors"
                >
                  → {recommended.glyph} {recommended.label}
                </button>
              </div>
            )}

            {/* Explore grid */}
            <div className="space-y-1">
              <div className="text-terminal-dim text-[9px] tracking-widest">EXPLORE</div>
              {options.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => opt.unlocked && router.push(opt.href)}
                  disabled={!opt.unlocked}
                  className={`w-full flex items-center justify-between border px-3 py-2 text-xs transition-colors ${
                    opt.unlocked
                      ? "border-terminal-border text-terminal-text hover:border-terminal-green hover:text-terminal-green"
                      : "border-terminal-border/40 text-terminal-dim/50 cursor-not-allowed"
                  }`}
                >
                  <span>
                    {opt.glyph} {opt.label}
                  </span>
                  <span className="text-[10px]">
                    {opt.unlocked ? "Open ▸" : `Locked · ${opt.locked_reason ?? ""}`}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleExitClick}
              className="w-full border border-terminal-dim text-terminal-dim text-[11px] py-2 hover:text-terminal-red hover:border-terminal-red transition-colors"
            >
              [Exit System]
            </button>
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}
