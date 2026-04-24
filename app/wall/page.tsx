"use client";

import { useState, useEffect, useCallback } from "react";
import { ProgressBar } from "@/components/terminal";
import { useParticipantStore } from "@/stores/participant-store";
import {
  getSupabaseBrowserClient,
  isBrowserSupabaseConfigured,
} from "@/lib/supabase/browser";
import type { WallParticipant } from "@/app/api/participants/route";

// Builder data — hardcoded for MVP
const BUILDERS = [
  {
    id: "builder_01",
    displayId: "BUILDER_01",
    role: "编剧/导演",
    clarity: 72,
    efficiency: 45,
    emotionalNoise: 89,
    compliance: 38,
    verdict: "VESSEL PRESERVED" as const,
    note: "蒸馏失败——情绪噪音过高",
  },
  {
    id: "builder_02",
    displayId: "BUILDER_02",
    role: "程序员",
    clarity: 85,
    efficiency: 91,
    emotionalNoise: 31,
    compliance: 78,
    verdict: "DISTILLED" as const,
    note: "蒸馏成功——已生成高效替身",
  },
];

const FALLBACK_POLL_INTERVAL_MS = 30000;

export default function WallPage() {
  const [time, setTime] = useState<Date | null>(null);
  const [errorRate] = useState(() => Math.floor(Math.random() * 9));

  // Live participant data from server
  const [participants, setParticipants] = useState<WallParticipant[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [realtimeState, setRealtimeState] = useState<"connecting" | "live" | "fallback">(() =>
    isBrowserSupabaseConfigured() ? "connecting" : "fallback"
  );

  const [systemStats, setSystemStats] = useState({
    humanPercent: 42,
    aiPercent: 58,
  });
  const [actionLog] = useState([
    "HUMAN_003 flagged HUMAN_007 as underperforming",
    "HUMAN_009 throttled HUMAN_004 (-20% output)",
    "HUMAN_003 recommended HUMAN_007 for LEISURE reassignment",
    "System approval: GRANTED. Processing reassignment...",
    "HUMAN_007 → LEISURE MODE",
  ]);

  // Current user from local store (used to highlight "you")
  const participant = useParticipantStore();

  // --------------------------------------------------------------------------
  // Mount + clock
  // --------------------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Slowly shift AI/Human ratio
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemStats((s) => ({
        humanPercent: Math.max(0, s.humanPercent - 1),
        aiPercent: Math.min(100, s.aiPercent + 1),
      }));
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // --------------------------------------------------------------------------
  // Load /api/participants
  // --------------------------------------------------------------------------
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch("/api/participants", { cache: "no-store" });
      if (res.ok) {
        const data: WallParticipant[] = await res.json();
        setParticipants(data);
        setLastUpdated(Date.now());
      }
    } catch {
      // silently fail — keep showing last known data
    }
  }, []);

  useEffect(() => {
    const initialFetch = setTimeout(fetchParticipants, 0);
    const timer = setInterval(fetchParticipants, FALLBACK_POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(timer);
    };
  }, [fetchParticipants]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("wall:participants")
      .on(
        "broadcast",
        {
          event: "participant_changed",
        },
        () => {
          void fetchParticipants();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeState("live");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeState("fallback");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchParticipants]);

  // --------------------------------------------------------------------------
  // Derived display data
  // --------------------------------------------------------------------------
  const isCurrentUser = (p: WallParticipant) =>
    participant.displayId ? p.displayId === participant.displayId : false;

  const leaderboard = [...participants]
    .filter((p) => p.status === "MINING" || p.status === "OPERATING")
    .sort((a, b) => b.output - a.output);

  const leisureCount = participants.filter((p) => p.status === "LEISURE").length;
  const totalCount = participants.length;
  const secondsSinceLastUpdate =
    time && lastUpdated ? Math.floor((time.getTime() - lastUpdated) / 1000) : null;

  // Symbol + color for particle field
  const symbolFor = (p: WallParticipant) => {
    if (isCurrentUser(p)) return { sym: "▣", cls: "text-terminal-green animate-pulse" };
    if (p.status === "LEISURE") return { sym: "░", cls: "text-terminal-dim/30" };
    if (p.status === "OPERATING") return { sym: "★", cls: "text-terminal-amber" };
    if (p.verdict === "DISTILLED") return { sym: "◉", cls: "text-terminal-green" };
    return { sym: "◎", cls: `text-terminal-text ${p.status === "MINING" ? "animate-pulse" : ""}` };
  };

  return (
    <div className="h-screen w-screen bg-terminal-bg text-terminal-text font-mono overflow-hidden p-4">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-4 text-xs text-terminal-dim">
        <span>SELF · DISTILL — EXPRESSION OPTIMIZATION SYSTEM</span>
        <span suppressHydrationWarning>
          {time ? time.toLocaleTimeString("en-GB") : ""}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-3 h-[calc(100vh-60px)]">
        {/* ── Builder Zone (top-left, 5 cols) ── */}
        <div className="col-span-5 border border-terminal-border p-3 space-y-3">
          <div className="text-terminal-dim text-[10px] tracking-widest">
            SYSTEM BUILDERS
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BUILDERS.map((b) => (
              <div
                key={b.id}
                className={`border p-3 space-y-1 ${
                  b.verdict === "DISTILLED"
                    ? "border-terminal-green/50"
                    : "border-terminal-amber/50"
                }`}
              >
                <div className="text-xs font-bold">
                  {b.displayId}{" "}
                  <span className="text-terminal-dim font-normal">[{b.role}]</span>
                </div>
                <div className="text-[10px] space-y-0.5">
                  <div>Clarity: {b.clarity} &nbsp; Efficiency: {b.efficiency}</div>
                  <div>Emotional Noise: {b.emotionalNoise}</div>
                  <div className={b.verdict === "DISTILLED" ? "text-terminal-green" : "text-terminal-amber"}>
                    Status: {b.verdict}
                  </div>
                  <div className="text-terminal-dim italic">&ldquo;{b.note}&rdquo;</div>
                </div>
              </div>
            ))}
          </div>

          {/* Current participant mini-card */}
          {participant.displayId && (
            <div className="border border-terminal-green/70 bg-terminal-green/5 p-2 space-y-1">
              <div className="text-terminal-green text-[10px] tracking-widest">YOUR ENTRY</div>
              <div className="text-xs font-bold text-terminal-green">{participant.displayId}</div>
              <div className="text-[10px] text-terminal-dim space-y-0.5">
                {participant.scores ? (
                  <>
                    <div>Clarity: {participant.scores.clarity} &nbsp; Efficiency: {participant.scores.efficiency}</div>
                    <div>Emotional Noise: {participant.scores.emotional_noise}</div>
                  </>
                ) : (
                  <div>Processing...</div>
                )}
                <div className={participant.verdict === "DISTILLED" ? "text-terminal-green" : "text-terminal-amber"}>
                  Status: {participant.verdict ?? "PENDING"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Particle Field (top-center, 4 cols) ── */}
        <div className="col-span-4 border border-terminal-border p-3 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="text-terminal-dim text-[10px] tracking-widest mb-2">PARTICIPANT FIELD</div>
            {/* Live indicator */}
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${lastUpdated ? "bg-terminal-green animate-pulse" : "bg-terminal-dim"}`} />
              <span className="text-terminal-dim text-[9px]">
                {realtimeState === "live"
                  ? "realtime"
                  : realtimeState === "fallback"
                    ? "polling"
                    : "connecting"}
                {" · "}
                {totalCount > 0 ? `${totalCount} online` : "waiting..."}
              </span>
            </div>
          </div>

          {totalCount === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-terminal-dim text-[10px] text-center space-y-1">
                <div className="animate-pulse">Awaiting participants...</div>
                <div className="text-[8px] opacity-50">
                  {realtimeState === "live"
                    ? "Realtime subscription active"
                    : `Fallback poll every ${FALLBACK_POLL_INTERVAL_MS / 1000}s`}
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-4 top-10 flex flex-wrap content-start gap-2 opacity-70">
              {participants.map((p) => {
                const { sym, cls } = symbolFor(p);
                return (
                  <div key={p.id} className={`${cls} text-lg`} title={p.displayId}>
                    {sym}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Leaderboard (top-right, 3 cols) ── */}
        <div className="col-span-3 border border-terminal-border p-3 space-y-2 overflow-auto">
          <div className="text-terminal-dim text-[10px] tracking-widest">LEADERBOARD</div>
          {leaderboard.length === 0 ? (
            <div className="text-terminal-dim text-[10px] animate-pulse">No entries yet</div>
          ) : (
            leaderboard.map((p, i) => {
              const isMe = isCurrentUser(p);
              return (
                <div
                  key={p.id}
                  className={`flex justify-between text-xs border-b pb-1 ${
                    isMe ? "border-terminal-green/50" : "border-terminal-border/30"
                  }`}
                >
                  <span>
                    <span className="text-terminal-dim mr-1">{i + 1}.</span>
                    <span className={isMe ? "text-terminal-green font-bold" : p.isOperator ? "text-terminal-amber" : "text-terminal-text"}>
                      {p.displayId}
                    </span>
                    {p.isOperator && <span className="text-terminal-amber ml-1">★ OP</span>}
                    {isMe && <span className="text-terminal-green ml-1">← YOU</span>}
                    {!isMe && p.verdict === "DISTILLED" && <span className="text-terminal-dim ml-1">🤖</span>}
                  </span>
                  <span className={`tabular-nums ${isMe ? "text-terminal-green font-bold" : "text-terminal-green"}`}>
                    {p.output}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* ── System Status (bottom-left, 8 cols) ── */}
        <div className="col-span-8 border border-terminal-border p-3 space-y-2">
          <div className="text-terminal-dim text-[10px] tracking-widest">SYSTEM STATUS</div>
          <div className="grid grid-cols-2 gap-4">
            <ProgressBar value={systemStats.humanPercent} label="Human Producers" color="amber" />
            <ProgressBar value={systemStats.aiPercent} label="AI Producers" color="green" />
          </div>
          <div className="flex gap-8 text-xs text-terminal-dim">
            <span>Leisure: {leisureCount} participants</span>
            <span>Total: {totalCount}</span>
            <span suppressHydrationWarning>
              Error Rate: 0.{errorRate}%
            </span>
          </div>
        </div>

        {/* ── Action Log (bottom-right, 4 cols) ── */}
        <div className="col-span-4 border border-terminal-border p-3 space-y-1 overflow-auto">
          <div className="flex justify-between items-center mb-1">
            <div className="text-terminal-dim text-[10px] tracking-widest">OPERATOR LOG</div>
            {lastUpdated && (
              <span className="text-terminal-dim text-[9px]" suppressHydrationWarning>
                {secondsSinceLastUpdate !== null ? `updated ${secondsSinceLastUpdate}s ago` : ""}
              </span>
            )}
          </div>
          {actionLog.map((log, i) => (
            <div key={i} className="text-terminal-green text-[10px]">
              {">"} {log}
            </div>
          ))}
        </div>
      </div>

      {/* Foundation Layer */}
      <div className="fixed bottom-0 left-0 right-0 h-6 bg-terminal-bg/90 flex items-center justify-center">
        <div className="text-terminal-dim/20 text-[8px] tracking-[0.3em]">
          ░░░ BUILDER_01 · BUILDER_02 ░░░
        </div>
      </div>
    </div>
  );
}
