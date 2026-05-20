"use client";

// v4 projection wall — 4-quadrant grid.
// Reference: docs/v4-migration-plan.md Phase 8; project_v4 IV.
//
// Layout (12-col grid, full viewport, dark terminal aesthetic):
//
//   ┌─────────────┬─────────────┐
//   │  B Particles│  A At-Risk  │   (top half)
//   ├─────────────┼─────────────┤
//   │  D Graveyard│  C Announce │   (bottom half)
//   └─────────────┴─────────────┘
//
// Realtime + polling fallback kept from v3 wall. This component is intentionally
// thin: each quadrant owns its own data shape and rendering.

import { useCallback, useEffect, useState } from "react";
import {
  getSupabaseBrowserClient,
  isBrowserSupabaseConfigured,
} from "@/lib/supabase/browser";
import { useParticipantStore } from "@/stores/participant-store";
import type { WallParticipant } from "@/lib/participants/types";
import { QuadrantA_AtRisk } from "@/components/wall/QuadrantA_AtRisk";
import {
  QuadrantB_Particles,
  type AttackEvent,
} from "@/components/wall/QuadrantB_Particles";
import {
  QuadrantC_Announcements,
  type Announcement,
} from "@/components/wall/QuadrantC_Announcements";
import { QuadrantD_Graveyard } from "@/components/wall/QuadrantD_Graveyard";

const FALLBACK_POLL_INTERVAL_MS = 30_000;
const ANNOUNCEMENT_TTL_MS = 8_000;
const ATTACK_OVERLAY_TTL_MS = 1_400; // matches QuadrantB attack-beam keyframes

export default function WallPage() {
  const participant = useParticipantStore();

  const [time, setTime] = useState<Date | null>(null);
  const [participants, setParticipants] = useState<WallParticipant[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [realtimeState, setRealtimeState] = useState<"connecting" | "live" | "fallback">(
    () => (isBrowserSupabaseConfigured() ? "connecting" : "fallback"),
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeAttacks, setActiveAttacks] = useState<AttackEvent[]>([]);

  // Top-bar clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // /api/participants polling
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch("/api/participants", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as WallParticipant[];
      setParticipants(data);
      setLastUpdated(Date.now());
    } catch {
      /* keep last-known state */
    }
  }, []);

  useEffect(() => {
    // External-system sync: kick off fetch (calls setState inside an async
    // callback, not synchronously in the effect body).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchParticipants();
    const id = setInterval(fetchParticipants, FALLBACK_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchParticipants]);

  // Realtime subscription (broadcast channel `wall:participants`)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("wall:participants")
      .on("broadcast", { event: "participant_changed" }, () => {
        void fetchParticipants();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeState("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeState("fallback");
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchParticipants]);

  // Announcement queue maintenance — drop entries older than TTL
  useEffect(() => {
    const t = setInterval(() => {
      setAnnouncements((list) => {
        const cutoff = Date.now() - ANNOUNCEMENT_TTL_MS;
        return list.filter((a) => a.at >= cutoff);
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const pushAnnouncement = useCallback((a: Announcement) => {
    setAnnouncements((list) => [a, ...list].slice(0, 12));
  }, []);

  /** Push an in-flight attack overlay; auto-expires after ATTACK_OVERLAY_TTL_MS. */
  const pushAttackEvent = useCallback((evt: AttackEvent) => {
    setActiveAttacks((list) => [...list, evt]);
    window.setTimeout(() => {
      setActiveAttacks((list) => list.filter((e) => e.id !== evt.id));
    }, ATTACK_OVERLAY_TTL_MS);
  }, []);

  // Subscribe to wall:events channel for backdoor_attack + operator_action
  // payloads emitted by the new broadcast triggers in 202605200002 migration.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("wall:events")
      .on("broadcast", { event: "backdoor_attack" }, (msg) => {
        const p = (msg.payload ?? {}) as {
          attacker_display_id?: string;
          target_display_id?: string;
          action_type?: string;
          amount?: number;
        };
        const verb =
          p.action_type === "SIPHON"
            ? "siphoned"
            : p.action_type === "CORRUPT"
              ? "corrupted"
              : p.action_type === "SWAP"
                ? "swapped with"
                : "attacked";
        const text =
          p.action_type === "SIPHON" && p.amount
            ? `${p.attacker_display_id ?? "?"} (backdoor) ${verb} ${p.amount} credits from ${p.target_display_id ?? "?"}`
            : `${p.attacker_display_id ?? "?"} (backdoor) ${verb} ${p.target_display_id ?? "?"}`;
        const evtId = `bd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        pushAnnouncement({
          id: evtId,
          kind: "backdoor_attack",
          text,
          at: Date.now(),
        });
        if (p.attacker_display_id && p.target_display_id) {
          pushAttackEvent({
            id: evtId,
            sourceDisplayId: p.attacker_display_id,
            targetDisplayId: p.target_display_id,
            kind: "backdoor",
            at: Date.now(),
          });
        }
      })
      .on("broadcast", { event: "operator_action" }, (msg) => {
        const p = (msg.payload ?? {}) as {
          source_display_id?: string;
          target_display_id?: string;
          action_type?: string;
        };
        const verb = (p.action_type ?? "ACTED").toLowerCase();
        const evtId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        pushAnnouncement({
          id: evtId,
          kind: "flag",
          text: `${p.source_display_id ?? "?"} ${verb} ${p.target_display_id ?? "?"}`,
          at: Date.now(),
        });
        if (p.source_display_id && p.target_display_id) {
          pushAttackEvent({
            id: evtId,
            sourceDisplayId: p.source_display_id,
            targetDisplayId: p.target_display_id,
            kind: "operator",
            at: Date.now(),
          });
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pushAnnouncement, pushAttackEvent]);

  const onlineCount = participants.filter(
    (p) => !p.isPermanent && p.status !== "ARCHIVED",
  ).length;
  const archivedCount = participants.filter(
    (p) => !p.isPermanent && p.status === "ARCHIVED",
  ).length;

  return (
    <div className="h-screen w-screen bg-terminal-bg text-terminal-text font-mono overflow-hidden p-3 flex flex-col">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-2 text-[11px] text-terminal-dim flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>SELF · DISTILL — EXPRESSION OPTIMIZATION SYSTEM</span>
          <span className="text-[9px] opacity-70">
            {realtimeState === "live"
              ? "● realtime"
              : realtimeState === "fallback"
                ? "○ polling"
                : "◌ connecting"}
            {" · "}
            {onlineCount} online {archivedCount > 0 && `· ${archivedCount} archived`}
          </span>
        </div>
        <span suppressHydrationWarning>
          {time ? time.toLocaleTimeString("en-GB") : ""}
        </span>
      </div>

      {/* 4-quadrant grid */}
      <div className="grid grid-cols-2 grid-rows-2 gap-3 flex-1 overflow-hidden">
        {/* B (top-left) */}
        <div className="overflow-hidden">
          <QuadrantB_Particles
            participants={participants}
            currentUserDisplayId={participant.displayId || undefined}
            activeAttacks={activeAttacks}
          />
        </div>
        {/* A (top-right) */}
        <div className="overflow-hidden">
          <QuadrantA_AtRisk participants={participants} />
        </div>
        {/* D (bottom-left) */}
        <div className="overflow-hidden">
          <QuadrantD_Graveyard />
        </div>
        {/* C (bottom-right) */}
        <div className="overflow-hidden">
          <QuadrantC_Announcements
            participants={participants}
            announcements={announcements}
            pushAnnouncement={pushAnnouncement}
          />
        </div>
      </div>

      {/* Footer (kept thin — no Builder strip; Builders now live in Graveyard) */}
      <div className="flex justify-between items-center mt-2 text-[9px] text-terminal-dim/50 flex-shrink-0">
        <span>v4 · {participants.length} records</span>
        <span suppressHydrationWarning>
          {time && lastUpdated
            ? `updated ${Math.floor((time.getTime() - lastUpdated) / 1000)}s ago`
            : "—"}
        </span>
      </div>
    </div>
  );
}
