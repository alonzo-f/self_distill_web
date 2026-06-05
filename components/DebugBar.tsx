"use client";

// Global debug strip — always visible during dev / 演出 prep.
// Provides a one-click "Reset Session" so testers can flush localStorage
// and Zustand state from any page (otherwise once phase is persisted
// they get auto-routed past / before they can reach the reset button).

import { usePathname } from "next/navigation";

export function DebugBar() {
  const pathname = usePathname();

  // Hide entirely in production (e.g. the public Vercel deployment), so the
  // installation looks "live" rather than in developer mode. Set
  // NEXT_PUBLIC_SHOW_DEBUG_BAR=1 to force it back on — e.g. for on-site
  // 演出 prep where testers need the one-click reset on a production build.
  const showDebug =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_SHOW_DEBUG_BAR === "1";
  if (!showDebug) return null;

  // Hide on /wall so the projection display stays clean.
  if (pathname === "/wall") return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex justify-between items-center text-[10px] font-mono text-terminal-dim/80 px-3 py-1 bg-black/40 backdrop-blur-sm pointer-events-auto"
      style={{ paddingTop: "max(env(safe-area-inset-top), 4px)" }}
    >
      <span>self-distill · dev · {pathname}</span>
      <button
        onClick={() => {
          try {
            window.localStorage.clear();
          } catch {
            /* ignore */
          }
          // Hard reload back to /
          window.location.href = "/";
        }}
        className="border border-terminal-amber/60 text-terminal-amber px-2 py-0.5 hover:bg-terminal-amber/10"
      >
        Reset Session
      </button>
    </div>
  );
}
