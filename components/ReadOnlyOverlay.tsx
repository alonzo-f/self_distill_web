"use client";

// v4 read-only snapshot view for revisited stages.
// Reference: docs/v4-migration-plan.md Phase 3; project_v4 III. 阶段 0.5
//
// When a user revisits an already-completed page, RouteGuard renders this
// component INSTEAD of the page. It pulls the relevant snapshot out of
// localStorage and presents an inert, read-only summary with a Continue
// button. Implements the "system never lets you modify what you already
// said" rule.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TerminalWindow, SystemMessage } from "@/components/terminal";
import { loadSession, type PersistedSession } from "@/lib/local-storage";
import { ROUTE_ORDER, PHASE_TO_ROUTE } from "@/lib/state-machine";

interface ReadOnlyOverlayProps {
  pathname: string;       // current page path (e.g. "/calibrate")
  allowedRoute: string;   // the route the user is actually supposed to be on
}

export function ReadOnlyOverlay({ pathname, allowedRoute }: ReadOnlyOverlayProps) {
  const router = useRouter();
  const [session, setSession] = useState<PersistedSession | null>(null);

  useEffect(() => {
    // External-system sync: localStorage → React state, one-shot on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(loadSession());
  }, []);

  // [Continue ▶] advances one step in the linear order. If next step lands
  // them at their actual allowed page, route there directly.
  const handleContinue = () => {
    const currentIdx = ROUTE_ORDER.indexOf(pathname);
    const allowedIdx = ROUTE_ORDER.indexOf(allowedRoute);
    if (currentIdx === -1) {
      router.push(allowedRoute);
      return;
    }
    const nextIdx = currentIdx + 1;
    const nextRoute = nextIdx <= allowedIdx ? ROUTE_ORDER[nextIdx] : allowedRoute;
    router.push(nextRoute);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-terminal-bg">
      <div className="w-full max-w-lg opacity-90">
        <TerminalWindow title="PREVIOUS SUBMISSION — READ ONLY">
          <div className="space-y-4">
            <SystemMessage type="info">
              VIEWING YOUR PREVIOUS SUBMISSION
            </SystemMessage>
            <div className="text-terminal-dim text-xs leading-relaxed">
              The system does not permit modification of data it has already
              recorded. Step through your earlier choices to return to your
              current page.
            </div>

            <SnapshotPanel pathname={pathname} session={session} />

            <button
              onClick={handleContinue}
              className="w-full border border-terminal-amber text-terminal-amber px-4 py-3 text-sm hover:bg-terminal-amber/10 transition-colors"
            >
              Continue ▶
            </button>
            <div className="text-terminal-dim text-[10px] text-center">
              Your current page is {PHASE_TO_ROUTE[session?.phase ?? "UNREGISTERED"]}
            </div>
          </div>
        </TerminalWindow>
      </div>
    </div>
  );
}

/** Renders a minimal snapshot card based on which route was revisited. */
function SnapshotPanel({
  pathname,
  session,
}: {
  pathname: string;
  session: PersistedSession | null;
}) {
  if (!session) {
    return <div className="text-terminal-dim text-xs">Loading snapshot...</div>;
  }

  switch (pathname) {
    case "/":
      return (
        <SnapshotRow label="PSA">
          You watched the public service announcement.
        </SnapshotRow>
      );
    case "/register":
      return (
        <div className="space-y-2">
          <SnapshotRow label="HUMAN ID">{session.displayId || "—"}</SnapshotRow>
          <SnapshotRow label="DISPLAY NAME">
            {session.displayName ? `@${session.displayName}` : "—"}
          </SnapshotRow>
          {session.phoneLast4 && (
            <SnapshotRow label="RE-ENTRY CODE">****{session.phoneLast4}</SnapshotRow>
          )}
        </div>
      );
    case "/calibrate": {
      const calib = session.snapshots.calibration;
      if (!calib || calib.length === 0) {
        return <PlaceholderSnapshot label="CALIBRATION" />;
      }
      return (
        <div className="space-y-1.5">
          {calib.map((a, i) => (
            <SnapshotRow key={i} label={`Q${i + 1}`}>
              {a.selectedOption}
            </SnapshotRow>
          ))}
        </div>
      );
    }
    case "/task": {
      const expr = session.snapshots.expression;
      if (!expr) return <PlaceholderSnapshot label="EXPRESSION" />;
      return (
        <div className="space-y-2">
          <SnapshotRow label="PROMPT">{expr.promptText}</SnapshotRow>
          <div className="border border-terminal-border p-2 text-[11px] text-terminal-text max-h-32 overflow-y-auto">
            {expr.userInput}
          </div>
          <div className="text-[10px] text-terminal-dim">
            {expr.metrics.wordCount} words · {expr.metrics.pauseCount} pauses · {expr.metrics.deletionCount} revisions
          </div>
        </div>
      );
    }
    case "/distill": {
      const d = session.snapshots.distillation;
      if (!d) return <PlaceholderSnapshot label="DISTILLATION" />;
      return (
        <div className="space-y-1">
          <div className="text-terminal-dim text-[10px]">OPTIMIZED OUTPUT</div>
          <div className="border border-terminal-border p-2 text-[11px] text-terminal-text max-h-32 overflow-y-auto">
            {d.distilledText}
          </div>
        </div>
      );
    }
    case "/benchmark": {
      const b = session.snapshots.benchmark;
      if (!b) return <PlaceholderSnapshot label="BENCHMARK" />;
      return (
        <div className="space-y-2">
          <SnapshotRow label="YOUR RATING">{b.rating} / 10</SnapshotRow>
          <SnapshotRow label="TIER">{b.tier}</SnapshotRow>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-terminal-dim">
            <span>Clarity: {b.scores.clarity}</span>
            <span>Efficiency: {b.scores.efficiency}</span>
            <span>Noise: {b.scores.emotional_noise}</span>
            <span>Compliance: {b.scores.compliance}</span>
          </div>
        </div>
      );
    }
    case "/verdict":
      return (
        <SnapshotRow label="VERDICT">
          {session.snapshots.benchmark?.scores.assessment ?? "—"}
        </SnapshotRow>
      );
    default:
      return <div className="text-terminal-dim text-xs">No snapshot available.</div>;
  }
}

function SnapshotRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-terminal-dim text-[10px] tracking-widest w-24 flex-shrink-0">
        {label}
      </div>
      <div className="text-terminal-text text-xs">{children}</div>
    </div>
  );
}

function PlaceholderSnapshot({ label }: { label: string }) {
  return (
    <div className="text-terminal-dim text-[11px] italic">
      [{label} snapshot not captured — proceed with [Continue ▶]]
    </div>
  );
}
