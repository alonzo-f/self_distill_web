"use client";

// v4 (2026-05-22): global button-press SFX.
// Reference: docs/v4-migration-plan.md Phase 7; user request — "每个可操作
// 按钮都加上音效".
//
// One pointerdown listener on document fires playClickSfx() whenever the
// gesture lands on (or inside) a <button>. Three filtering rules:
//
//   1. <button data-no-sfx>           → skipped entirely. Use this for
//                                       buttons that already have richer
//                                       SFX (mine, gambling, attack...)
//                                       if you want to avoid stacking.
//   2. <button disabled>              → skipped.
//   3. nested triggers (label > input checkbox, etc.) → only fires once,
//                                       on the topmost button hit.
//
// Mount this component once near the root (layout.tsx). It also calls
// unlockAudio() inside the same gesture so iOS Safari's WebAudio context
// gets resumed on the very first tap of the experience.

import { useEffect } from "react";
import { playClickSfx, unlockAudio } from "@/lib/audio/eight-bit";

export function GlobalClickSfx() {
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest("button");
      if (!btn) return;
      if (btn.hasAttribute("disabled")) return;
      if (btn.hasAttribute("data-no-sfx")) return;
      // Fire-and-forget. unlockAudio doubles as the user-gesture handshake.
      void unlockAudio();
      playClickSfx();
    };
    // pointerdown beats click on mobile (no 300ms tap delay) and works
    // for both mouse and touch.
    document.addEventListener("pointerdown", handler, { passive: true });
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  return null;
}
