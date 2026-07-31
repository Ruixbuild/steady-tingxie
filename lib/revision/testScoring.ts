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

/** Chapter-wide version of defaultTestLevel, for the Test picker's
 * per-format "suggested" badge: suggests Level 2 once at least half this
 * chapter's words for that skill have reached level >= 2. The picker used
 * to base this on a single word (always words[0]) — so a full-chapter
 * Level-1 pass wouldn't bump the suggestion if that one word's own mastery
 * happened to lag (e.g. it was skipped, retried, or its write settled a
 * beat later than the others). Checking the whole set makes "pass every
 * word in the chapter" reliably flip the suggestion, matching what the
 * picker badge is meant to represent.
 *
 * Returns null once every one of this skill's words has reached level 3
 * (fully mastered, i.e. Level 2 already passed for all of them) — there's
 * no further level to suggest at that point, so the picker should dim
 * *both* cards rather than keep highlighting Level 2 as "suggested"
 * forever. */
export function defaultTestLevelForWords(
  words: RevisionVocab[],
  skill: "read" | "write",
  masteryByKey: Map<MasteryKey, RevisionMastery>
): 1 | 2 | null {
  if (words.length === 0) return 1;
  const mastered = words.filter((w) => skillLevel(w.id, skill, masteryByKey) >= 3).length;
  if (mastered === words.length) return null;
  const advanced = words.filter((w) => skillLevel(w.id, skill, masteryByKey) >= 2).length;
  return advanced / words.length >= 0.5 ? 2 : 1;
}

function hanziLength(hanzi: string): number {
  return Array.from(hanzi).length;
}

/** 识读 distractor pool for the multiple-choice formats (Level 1's listen &
 * pick, and Level 2's blanked-pairing match): same character length as the
 * target word first — pairing a 1-character word with 3-character
 * distractors would make the correct answer visually obvious without any
 * actual recognition needed. Within that length match, this chapter's own
 * words are tried first; if that alone doesn't have enough, it falls back
 * to any other word (any chapter) the child has already been exposed to
 * (an existing read-mastery row), and only relaxes the length match as a
 * last resort — so an unusually short or narrow chapter still gets a full
 * set of options rather than fewer than `count`. */
export function pickReadDistractors(
  target: RevisionVocab,
  chapterWords: RevisionVocab[],
  learntWords: RevisionVocab[],
  count: number
): RevisionVocab[] {
  const targetLen = hanziLength(target.hanzi);
  const picked: RevisionVocab[] = [];
  const usedIds = new Set([target.id]);

  function takeFrom(pool: RevisionVocab[], matchLength: boolean) {
    if (picked.length >= count) return;
    const candidates = shuffle(
      pool.filter((w) => !usedIds.has(w.id) && (!matchLength || hanziLength(w.hanzi) === targetLen))
    );
    for (const w of candidates) {
      if (picked.length >= count) break;
      picked.push(w);
      usedIds.add(w.id);
    }
  }

  takeFrom(chapterWords, true);
  takeFrom(learntWords, true);
  takeFrom(chapterWords, false);
  takeFrom(learntWords, false);
  return picked;
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
 * which case it's not eligible for Level 2. Picks randomly among every
 * eligible pairing (not just the first) so repeating the test on the same
 * word doesn't show an identical question every time. Callers must call
 * this once per word and reuse the result (e.g. for both the blanked
 * prompt and the later full-phrase reveal) rather than calling it twice,
 * since two calls could otherwise pick two different pairings for what's
 * supposed to be the same question. */
export function findPairingWithWord(word: RevisionVocab): string | null {
  const eligible = [word.pairing_1, word.pairing_2, word.pairing_3, word.pairing_4].filter(
    (p): p is string => p !== null && p !== "" && p.includes(word.hanzi)
  );
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function blankPairing(pairing: string, hanzi: string): string {
  return pairing.replace(hanzi, "＿".repeat(hanzi.length));
}

/** Splits a pairing into the text before/after the target word's first
 * occurrence — for 识写 Level 2, which shows the word's own writing boxes
 * embedded at that position within the sentence (instead of blankPairing's
 * plain "＿" placeholder text, which had no connection to the separate box
 * row rendered below it). Returns null if the word isn't actually in the
 * pairing — shouldn't happen given findPairingWithWord's own eligibility
 * check, but callers get an unambiguous "can't split this" signal instead
 * of silently rendering the whole pairing as "before" with an empty
 * "after". Only the first occurrence is split, matching blankPairing's
 * own .replace() (which only replaces the first match) so both formats
 * agree on which occurrence is "the blank" if the word appears twice. */
export function splitPairingAroundWord(
  pairing: string,
  hanzi: string
): { before: string; after: string } | null {
  const i = pairing.indexOf(hanzi);
  if (i === -1) return null;
  return { before: pairing.slice(0, i), after: pairing.slice(i + hanzi.length) };
}
