// Pure helpers for Revision's Test feature — sibling to TingXie's own
// lib/testScoring.ts, but keyed on Revision's read/write skill axis instead
// of SectionKind. No Supabase calls here.

import type { MasteryKey } from "./mastery";
import { skillLevel } from "./mastery";
import type { RevisionMastery, RevisionVocab } from "./types";

/** Adaptive leveling: a word already at level >= 2 (has passed its Level-1
 * test before) suggests Level 2 next; anything below suggests Level 1. Only
 * a suggestion for the picker screen — the child can still pick either
 * level manually. */
export function defaultTestLevel(
  vocabId: string,
  skill: "read" | "write",
  masteryByKey: Map<MasteryKey, RevisionMastery>
): 1 | 2 {
  return skillLevel(vocabId, skill, masteryByKey) >= 2 ? 2 : 1;
}

/** Random sample of `count` distractors from `pool`, excluding `target`.
 * Used to build multiple-choice options for the 识读 formats. Returns fewer
 * than `count` if the pool is too small (e.g. a short chapter). */
export function pickDistractors<T>(target: T, pool: T[], count: number): T[] {
  const candidates = pool.filter((item) => item !== target);
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

/** Shuffles an array of options (distractors + the correct answer) so the
 * correct choice isn't always in the same position. */
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A pairing containing the word's own hanzi, for the Level-2 "blank the
 * word out of its pairing" formats — or null if this word has none, in
 * which case it's not eligible for Level 2. */
export function findPairingWithWord(word: RevisionVocab): string | null {
  const pairings = [word.pairing_1, word.pairing_2, word.pairing_3, word.pairing_4];
  return pairings.find((p): p is string => p !== null && p !== "" && p.includes(word.hanzi)) ?? null;
}

export function blankPairing(pairing: string, hanzi: string): string {
  return pairing.replace(hanzi, "＿".repeat(hanzi.length));
}
