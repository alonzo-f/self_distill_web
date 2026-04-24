import { create } from "zustand";
import type { TypingEvent, TypingMetrics } from "@/types";

const PAUSE_THRESHOLD_MS = 3000; // 3 seconds = a "pause"

interface TypingTrackerState {
  startTime: number | null;
  lastKeyTime: number | null;
  events: TypingEvent[];
  pauseCount: number;
  deletionCount: number;
  charCount: number;
  text: string;

  // Actions
  start: () => void;
  recordKeydown: (key: string) => void;
  recordDelete: () => void;
  recordPaste: (text: string) => void;
  setText: (text: string) => void;
  getMetrics: () => TypingMetrics;
  reset: () => void;
}

export const useTypingTracker = create<TypingTrackerState>((set, get) => ({
  startTime: null,
  lastKeyTime: null,
  events: [],
  pauseCount: 0,
  deletionCount: 0,
  charCount: 0,
  text: "",

  start: () => set({ startTime: Date.now(), lastKeyTime: Date.now(), events: [], pauseCount: 0, deletionCount: 0, charCount: 0, text: "" }),

  recordKeydown: (key) => {
    const now = Date.now();
    const state = get();
    let newPauseCount = state.pauseCount;

    if (state.lastKeyTime && now - state.lastKeyTime > PAUSE_THRESHOLD_MS) {
      newPauseCount++;
    }

    set({
      lastKeyTime: now,
      pauseCount: newPauseCount,
      charCount: state.charCount + 1,
      events: [...state.events, { type: "keydown", timestamp: now, data: key }],
    });
  },

  recordDelete: () => {
    const now = Date.now();
    set((state) => ({
      deletionCount: state.deletionCount + 1,
      events: [...state.events, { type: "delete", timestamp: now }],
    }));
  },

  recordPaste: (text) => {
    const now = Date.now();
    set((state) => ({
      events: [...state.events, { type: "paste", timestamp: now, data: text }],
    }));
  },

  setText: (text) => set({ text }),

  getMetrics: () => {
    const state = get();
    const totalDurationSec = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
    const words = state.text.trim().split(/\s+/).filter(Boolean);

    return {
      totalDurationSec: Math.round(totalDurationSec),
      pauseCount: state.pauseCount,
      deletionCount: state.deletionCount,
      wordCount: words.length,
      charCount: state.text.length,
    };
  },

  reset: () => set({ startTime: null, lastKeyTime: null, events: [], pauseCount: 0, deletionCount: 0, charCount: 0, text: "" }),
}));
