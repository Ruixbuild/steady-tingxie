// Pure helpers for "Keep it fresh" — random spaced-repetition-style
// re-testing of words that are already mastered but haven't been touched
// in a while. No Supabase calls here; callers (app/kid/[childId]/vocab/
// fresh/page.tsx) pass in rows they've already fetched.

import { masteryKey, maxLevelFor, tracksFor, type MasteryKey } from "./mastery";
import { shuffle } from "./testScoring";
import type { RevisionMastery, RevisionVocab } from "./types";

/** How long a mastered (word, skill) pair sits untouched before it's
 * eligible to be sampled — also the exclusion window in
 * sampleFreshPairs/revision_freshness_log, so a pair offered by a previous
 * sample stays out of the pool for the same span it took to go stale in
 * the first place, rather than a second, unrelated magic number. */
export const FRESHNESS_STALE_DAYS = 14;

export type FreshCandidate = { word: RevisionVocab; skill: "read" | "write" };

/** True once `lastSeenIso` is at least FRESHNESS_STALE_DAYS old. A mastered
 * word always has a last_seen (it was tested to get there), but this still
 * treats a missing one as stale rather than throwing, since callers pass
 * raw DB data. */
export function isStale(lastSeenIso: string | null, now: Date = new Date()): boolean {
  if (!lastSeenIso) return true;
  const ageMs = now.getTime() - new Date(lastSeenIso).getTime();
  return ageMs >= FRESHNESS_STALE_DAYS * 24 * 60 * 60 * 1000;
}

/** Every (word, skill) pair that's mastered on that specific track (see
 * maxLevelFor's ceiling rule) and hasn't been touched in
 * FRESHNESS_STALE_DAYS — the pool "Keep it fresh" samples from, before
 * excluding anything already offered recently (see sampleFreshPairs).
 * Per-track, not per-word: a "both"-skill word mastered on 识读 but stale
 * only on 识写 contributes just the 识写 pair, same granularity every other
 * mastery view in Revision already uses. */
export function staleMasteredPairs(
  words: RevisionVocab[],
  masteryByKey: Map<MasteryKey, RevisionMastery>,
  now: Date = new Date()
): FreshCandidate[] {
  const out: FreshCandidate[] = [];
  for (const word of words) {
    for (const skill of tracksFor(word.skill)) {
      const m = masteryByKey.get(masteryKey(word.id, skill));
      const mastered = (m?.level ?? 0) >= maxLevelFor(word);
      if (mastered && isStale(m?.last_seen ?? null, now)) out.push({ word, skill });
    }
  }
  return out;
}

/** Randomly samples up to `count` pairs from `pool`, excluding any
 * `${vocabId}:${skill}` key present in `excludeKeys` — pairs the
 * revision_freshness_log shows were already offered within
 * FRESHNESS_STALE_DAYS, so repeated "Keep it fresh" taps rotate through the
 * stale set instead of converging on the same words. */
export function sampleFreshPairs(
  pool: FreshCandidate[],
  excludeKeys: Set<string>,
  count: number
): FreshCandidate[] {
  const eligible = pool.filter((p) => !excludeKeys.has(`${p.word.id}:${p.skill}`));
  return shuffle(eligible).slice(0, count);
}
