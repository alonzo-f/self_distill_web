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

// v4 (2026-05-22): faster fallback poll so the kill animation has a chance
// of firing for participants watching the wall even when Supabase realtime
// is unavailable. The wall also picks up `sessionStorage` handoffs from the
// attack page on mount (item 6+7 of 修改0519.md).
const FALLBACK_POLL_INTERVAL_MS = 5_000;
const ANNOUNCEMENT_TTL_MS = 8_000;
// v4 (2026-05-22, 修改0519.md item 7): the kill animation now spans the
// 3-pulse red flash (1.5s) + cluster shake + ring pulse, so widen the TTL.
const ATTACK_OVERLAY_TTL_MS = 3_000;

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

  /**
   * v4 (2026-05-22, 修改0519.md item 6+7): the attack page stashes the
   * attack details in sessionStorage just before redirecting here. Replay
   * the kill animation + announcement on mount so the attacker sees their
   * own action play out instantly, without waiting for Supabase realtime
   * or the polling diff to catch up.
   */
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("self-distill:pending-attack");
      if (raw) sessionStorage.removeItem("self-distill:pending-attack");
    } catch {
      /* sessionStorage unavailable */
    }
    if (!raw) return;
    try {
      const evt = JSON.parse(raw) as {
        targetDisplayId: string;
        attackerDisplayId?: string;
        actionType?: string;
        amount?: number | null;
        at?: number;
      };
      if (!evt.targetDisplayId) return;
      // Skip stale events (>30s old) so an old session doesn't replay.
      if (evt.at && Date.now() - evt.at > 30_000) return;

      const evtId = `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const suffix =
        evt.actionType === "SIPHON" && evt.amount
          ? ` (siphoned ${evt.amount} credits)`
          : "";
      pushAnnouncement({
        id: evtId,
        kind: "backdoor_attack",
        text: `${evt.attackerDisplayId ?? "?"} killed ${evt.targetDisplayId}${suffix}`,
        at: Date.now(),
      });
      pushAttackEvent({
        id: evtId,
        sourceDisplayId: evt.attackerDisplayId ?? "?",
        targetDisplayId: evt.targetDisplayId,
        kind: "backdoor",
        at: Date.now(),
      });
    } catch {
      /* malformed payload — ignore */
    }
    // Intentionally empty deps: one-shot on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * v4 (2026-05-22, 修改0519.md item 7): detect newly-archived participants
   * via poll diff. When a participant flips from non-ARCHIVED to ARCHIVED
   * between polls, fire the kill animation. This is the fallback path when
   * Supabase realtime is unavailable.
   */
  const knownArchivedRef =
    typeof globalThis !== "undefined"
      ? (globalThis as { __wallKnownArchived?: Set<string> }).__wallKnownArchived
      : undefined;
  useEffect(() => {
    const seen =
      knownArchivedRef ??
      (() => {
        const s = new Set<string>();
        (globalThis as { __wallKnownArchived?: Set<string> }).__wallKnownArchived = s;
        return s;
      })();
    for (const p of participants) {
      if (p.isPermanent || p.status !== "ARCHIVED") continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      // Don't replay archives we've already announced via session-storage.
      // (Both paths are idempotent enough — the overlay just won't double-up
      // because the announcement IDs are unique.)
      const evtId = `arch-${p.id}-${Date.now()}`;
      pushAttackEvent({
        id: evtId,
        sourceDisplayId: "system",
        targetDisplayId: p.displayId,
        kind: "backdoor",
        at: Date.now(),
      });
    }
  }, [participants, pushAttackEvent, knownArchivedRef]);

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
        // v4 (user-driven update): every attack is now a kill.
        const evtId = `bd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const suffix =
          p.action_type === "SIPHON" && p.amount
            ? ` (siphoned ${p.amount} credits)`
            : "";
        pushAnnouncement({
          id: evtId,
          kind: "backdoor_attack",
          text: `${p.attacker_display_id ?? "?"} killed ${p.target_display_id ?? "?"}${suffix}`,
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
        const evtId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        pushAnnouncement({
          id: evtId,
          kind: "flag",
          text: `${p.source_display_id ?? "?"} eliminated ${p.target_display_id ?? "?"}`,
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

  // v4 (2026-05-22, 修改0519.md item 3): if the participant has spent their
  // attack token (i.e. they got here by attacking from the backdoor), they
  // are now in observer mode — display a permanent banner so they
  // understand their participation is complete.
  const isObserver = participant.backendUnlocked && participant.attackTokens === 0;

  return (
    <div className="h-screen w-screen bg-terminal-bg text-terminal-text font-mono overflow-hidden p-3 flex flex-col">
      {/* v4 (2026-05-22, 修改0519.md item 3): observer-mode banner. Visible
          only to participants who completed the full flow + spent their
          attack token. Lets them know their session is now read-only. */}
      {isObserver && (
        <div className="mb-2 border-2 border-amber-300 bg-amber-300/10 px-3 py-2 text-amber-300 text-[11px] tracking-widest flex items-center justify-between animate-pulse flex-shrink-0">
          <span>👁 OBSERVER MODE</span>
          <span className="text-amber-300/70 text-[10px]">
            {participant.displayId} · your action has been recorded · enjoy the show
          </span>
        </div>
      )}

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
