"use client";

// v4 projection wall · Quadrant C · LIVE ANNOUNCEMENTS (bottom-right).
// Reference: docs/v4-migration-plan.md Phase 8; project_v4 IV.
//
// 3-5s fade-in/out event stream. Phase 8 ships:
//   - join / archive events derived from participant diffs
//   - placeholder hints when no traffic
// Phase 9 / 10 (operator + backdoor) will broadcast richer events via
// Supabase Realtime and push them into the same announcement queue.

import { useEffect, useRef } from "react";
import type { WallParticipant } from "@/lib/participants/types";

const ICONS: Record<AnnouncementKind, string> = {
  join: "▣",
  archive: "💀",
  jackpot: "🎰",
  flag: "⚠",
  backdoor_unlock: "🔓",
  backdoor_attack: "⚔",
  system: "·",
};

type AnnouncementKind =
  | "join"
  | "archive"
  | "jackpot"
  | "flag"
  | "backdoor_unlock"
  | "backdoor_attack"
  | "system";

export interface Announcement {
  id: string;
  kind: AnnouncementKind;
  text: string;
  at: number;
}

interface QuadrantC_AnnouncementsProps {
  participants: WallParticipant[];
  /** Latest 5 announcements, newest first. Owner: parent wall component. */
  announcements: Announcement[];
  /** Append-only setter, so children can push events. */
  pushAnnouncement: (a: Announcement) => void;
}

const MAX_VISIBLE = 5;

export function QuadrantC_Announcements({
  participants,
  announcements,
  pushAnnouncement,
}: QuadrantC_AnnouncementsProps) {
  // Watch participants for joins / archives and emit corresponding announcements.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const archivedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const p of participants) {
      if (p.isPermanent) continue;
      if (!seenIdsRef.current.has(p.id)) {
        seenIdsRef.current.add(p.id);
        // Skip emitting "join" for participants already in DB at first load —
        // we infer "first load" by checking ref size growth past the
        // initial batch. Simpler approach: only emit if we have already
        // processed at least one render's worth.
        if (seenIdsRef.current.size > participants.length / 2) {
          pushAnnouncement({
            id: `join-${p.id}-${Date.now()}`,
            kind: "join",
            text: `${p.displayId} joined the optimization pipeline`,
            at: Date.now(),
          });
        }
      }
      if (p.status === "ARCHIVED" && !archivedIdsRef.current.has(p.id)) {
        archivedIdsRef.current.add(p.id);
        pushAnnouncement({
          id: `arch-${p.id}-${Date.now()}`,
          kind: "archive",
          text: `${p.displayId} has been archived`,
          at: Date.now(),
        });
      }
    }
  }, [participants, pushAnnouncement]);

  const visible = announcements.slice(0, MAX_VISIBLE);

  return (
    <Panel label="LIVE ANNOUNCEMENTS">
      {visible.length === 0 ? (
        <div className="text-terminal-dim/40 text-[10px] italic">
          System idle. Listening...
        </div>
      ) : (
        <div className="space-y-1">
          {visible.map((a, i) => (
            <div
              key={a.id}
              className="text-[11px] font-mono flex items-baseline gap-2 leading-tight"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <span
                className={
                  a.kind === "archive"
                    ? "text-terminal-red"
                    : a.kind === "jackpot"
                      ? "text-amber-300"
                      : a.kind === "backdoor_attack"
                        ? "text-terminal-red"
                        : a.kind === "backdoor_unlock"
                          ? "text-amber-300"
                          : "text-terminal-dim"
                }
              >
                {ICONS[a.kind]}
              </span>
              <span className="text-terminal-text">{a.text}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-terminal-border h-full p-2.5 flex flex-col">
      <div className="text-terminal-dim text-[10px] tracking-widest mb-2">{label}</div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
