// Shared mapping for the two permanent "builder" anchors.
//
// Drop the portrait images into `public/builders/` (see the README there):
//   BUILDER_01 → public/builders/builder_01.png
//   BUILDER_02 → public/builders/builder_02.png
//
// If a file is missing, components fall back to the builder's ID text, so the
// UI never breaks. To use a different filename/extension, edit the map below.

export const BUILDER_AVATARS: Record<string, string> = {
  BUILDER_01: "/builders/builder_01.png",
  BUILDER_02: "/builders/builder_02.png",
};

/** Returns the avatar path for a builder display id/name, or null if unknown. */
export function builderAvatar(idOrName: string | null | undefined): string | null {
  if (!idOrName) return null;
  return BUILDER_AVATARS[idOrName.trim().toUpperCase()] ?? null;
}
