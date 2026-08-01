// Pure helpers for the vocab hub's cross-chapter "farm scene" — a trophy
// shelf, not a growth simulation: a slot only ever shows an icon once its
// chapter+skill is fully mastered (see mastery.ts's skillProgress), there is
// no partial/growth-stage state. Deliberately separate from lib/garden.ts
// (TingXie's own seasonal garden) rather than extending it — different
// domain (chapter+skill, not per-item), different rules (no growth ladder,
// no term/season rotation, no fade-by-recency), and per CLAUDE.md's
// Revision guardrails, new Revision logic stays in its own files.

// 32-bit unsigned multiply-add hash — same algorithm lib/garden.ts uses for
// its own deterministic-but-varied tree species pick, reimplemented here
// rather than imported so this file has no dependency on TingXie's garden
// module.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// 识读 (recognition) mastery → land animals. 识写 (writing) mastery → sea
// animals. The land/sea split (rather than e.g. animals/birds) was chosen
// specifically for pool size: real flying-bird emoji are a short list,
// while both land and sea creatures have enough variety that a 20-chapter
// level rarely repeats a species.
export const LAND_ANIMALS = [
  "🦁", "🦒", "🐻", "🦓", "🐵", "🦊", "🐼", "🐘", "🦌", "🐰",
  "🐨", "🦔", "🐹", "🦘", "🐺", "🦏", "🐫", "🦥", "🐿️", "🐗",
] as const;

export const SEA_ANIMALS = [
  "🐬", "🐢", "🐠", "🦭", "🐙", "🦀", "🐟", "🦞", "🦈", "🐡",
  "🦐", "🦑", "🐳", "🦦", "🐋", "🦪", "🐌", "🦎", "🐊", "🦫",
] as const;

/** Deterministic species pick so the same chapter+skill always renders the
 * same icon across reloads/re-renders — not randomized per view. */
export function pickSpecies(pool: readonly string[], seedKey: string): string {
  return pool[hashString(seedKey) % pool.length];
}

export type FarmSlot = {
  chapterNumber: number;
  chapterTitle: string;
  mastered: boolean;
  species: string;
};

/** One slot per chapter, in chapter order, for a single skill — chapters
 * with a gap in their numbering just render fewer slots rather than
 * assuming 1..N contiguity, since slot position is "this chapter", not "the
 * Nth chapter". */
export function buildFarmSlots(
  chapters: { chapterNumber: number; chapterTitle: string; mastered: boolean }[],
  skill: "read" | "write"
): FarmSlot[] {
  const pool = skill === "read" ? LAND_ANIMALS : SEA_ANIMALS;
  return chapters.map((c) => ({
    chapterNumber: c.chapterNumber,
    chapterTitle: c.chapterTitle,
    mastered: c.mastered,
    species: pickSpecies(pool, `${c.chapterNumber}:${skill}`),
  }));
}
