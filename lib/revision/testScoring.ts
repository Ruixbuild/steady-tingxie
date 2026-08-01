// Pure helpers for Revision's Test feature — sibling to TingXie's own
// lib/testScoring.ts, but keyed on Revision's read/write skill axis instead
// of SectionKind. No Supabase calls here.

import type { MasteryKey } from "./mastery";
import { hasEligiblePairing, isTricky, skillLevel, tracksFor } from "./mastery";
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

export type TrickyLeg = { skill: "read" | "write"; level: 1 | 2; words: RevisionVocab[] };

/** Session-length cap shared by buildTrickyLegs and "Keep it fresh"
 * (lib/revision/freshness.ts's per-skill sample size) — at most this many
 * distinct words get practiced per skill in one cross-chapter session,
 * regardless of how many actually qualify. Applied before splitting into
 * Level 1/Level 2 legs, so a word eligible for both formats still only
 * counts once against the cap. */
export const MAX_WORDS_PER_SKILL = 5;

/** Cross-chapter tricky words, split into the same up-to-four skill+level
 * "legs" the per-chapter Test picker's tricky-only toggle already computes
 * (see TestHost's readTrickyWordsL1/L2, writeTrickyWordsL1/L2) — kept
 * consistent with that definition rather than reinvented, so a word that
 * shows up as tricky on the picker shows up in the same leg here. Empty
 * legs are omitted entirely, so a cross-chapter practice session only ever
 * walks through formats that actually have something to practice.
 *
 * Each skill's tricky words are capped at MAX_WORDS_PER_SKILL (chosen
 * randomly, not just the first N) before being split into its L1/L2 legs —
 * a chapter-spanning tricky list can otherwise run to dozens of words,
 * which read as an endless test rather than a quick practice round. */
export function buildTrickyLegs(
  words: RevisionVocab[],
  masteryByKey: Map<MasteryKey, RevisionMastery>
): TrickyLeg[] {
  const readWords = words.filter((w) => tracksFor(w.skill).includes("read"));
  const writeWords = words.filter((w) => tracksFor(w.skill).includes("write"));
  const legs: TrickyLeg[] = [];

  const readTricky = shuffle(readWords.filter((w) => isTricky(w, "read", masteryByKey))).slice(
    0,
    MAX_WORDS_PER_SKILL
  );
  const readL1 = readTricky.filter((w) => skillLevel(w.id, "read", masteryByKey) < 2);
  if (readL1.length > 0) legs.push({ skill: "read", level: 1, words: readL1 });

  const readL2 = readTricky.filter((w) => findPairingWithWord(w) !== null);
  if (readL2.length > 0) legs.push({ skill: "read", level: 2, words: readL2 });

  const writeTricky = shuffle(writeWords.filter((w) => isTricky(w, "write", masteryByKey))).slice(
    0,
    MAX_WORDS_PER_SKILL
  );
  const writeL1 = writeTricky.filter((w) => skillLevel(w.id, "write", masteryByKey) < 2);
  if (writeL1.length > 0) legs.push({ skill: "write", level: 1, words: writeL1 });

  const writeL2 = writeTricky.filter((w) => findPairingWithWord(w) !== null);
  if (writeL2.length > 0) legs.push({ skill: "write", level: 2, words: writeL2 });

  return legs;
}

/** Groups arbitrary (word, skill) pairs into the same TrickyLeg shape
 * buildTrickyLegs produces, splitting each skill's pairs into Level 1/Level
 * 2 by pairing eligibility (hasEligiblePairing) rather than buildTrickyLegs's
 * isTricky filter — used by "Keep it fresh" (lib/revision/freshness.ts),
 * whose pairs are already-mastered words by definition, so retesting them
 * at the level that earned that mastery (Level 2 if the word has an
 * eligible pairing, else Level 1 — mirroring maxLevelFor's own ceiling
 * rule) is the point, not filtering for trickiness. */
export function buildLegsFromPairs(pairs: { word: RevisionVocab; skill: "read" | "write" }[]): TrickyLeg[] {
  const legs: TrickyLeg[] = [];
  for (const skill of ["read", "write"] as const) {
    const skillWords = pairs.filter((p) => p.skill === skill).map((p) => p.word);
    const l1 = skillWords.filter((w) => !hasEligiblePairing(w));
    if (l1.length > 0) legs.push({ skill, level: 1, words: l1 });
    const l2 = skillWords.filter((w) => hasEligiblePairing(w));
    if (l2.length > 0) legs.push({ skill, level: 2, words: l2 });
  }
  return legs;
}
