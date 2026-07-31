// Pure helpers for Revision's mastery display — no Supabase calls here,
// callers pass in rows they've already fetched.

import type { RevisionMastery, RevisionSkill, RevisionVocab } from "./types";

/** Revision's own 4-stage mastery symbol set — deliberately different from
 * TingXie's plant stages (HubWordList.tsx/GardenClient.tsx's 🌱🌿🌸🌳), per
 * the "different mastery symbol in vocab revision vs tingxie" design call:
 * egg -> hatched egg -> chick -> chicken, matching the 🐓-farm framing
 * without depending on that mascot itself for the day-to-day level badge. */
export const STAGE_EMOJI = ["🥚", "🐣", "🐥", "🐔"] as const;

export type MasteryKey = `${string}:${"read" | "write"}`;
export function masteryKey(vocabId: string, skill: "read" | "write"): MasteryKey {
  return `${vocabId}:${skill}`;
}

export function masteryMapFromRows(rows: RevisionMastery[]): Map<MasteryKey, RevisionMastery> {
  return new Map(rows.map((m) => [masteryKey(m.vocab_id, m.skill), m]));
}

/** Which mastery tracks a skill requires. */
export function tracksFor(skill: RevisionSkill): ("read" | "write")[] {
  if (skill === "both") return ["read", "write"];
  return [skill];
}

/** A word only counts as "mastered" once every track it requires has
 * level >= 3 (passed the harder Level-2 test) — a "both" word that's
 * strong on 识读 but still level 1 on 识写 is not mastered, even though one
 * of its two tracks is. Returns the 0-3 stage index for STAGE_EMOJI: the
 * word's *lowest* track level, since that's the one holding it back. */
export function wordStage(word: RevisionVocab, masteryByKey: Map<MasteryKey, RevisionMastery>): number {
  const levels = tracksFor(word.skill).map((skill) => masteryByKey.get(masteryKey(word.id, skill))?.level ?? 0);
  return Math.min(...levels);
}

export function isWordMastered(word: RevisionVocab, masteryByKey: Map<MasteryKey, RevisionMastery>): boolean {
  return wordStage(word, masteryByKey) >= 3;
}

/** A single track's own level (0-3) — for the per-skill chip groups on the
 * chapter hub, where each group shows that specific track's stage rather
 * than the word's overall (lowest-track) stage. */
export function skillLevel(
  vocabId: string,
  skill: "read" | "write",
  masteryByKey: Map<MasteryKey, RevisionMastery>
): number {
  return masteryByKey.get(masteryKey(vocabId, skill))?.level ?? 0;
}

export function isFlagged(
  vocabId: string,
  masteryByKey: Map<MasteryKey, RevisionMastery>
): boolean {
  return (
    (masteryByKey.get(masteryKey(vocabId, "read"))?.flagged ?? false) ||
    (masteryByKey.get(masteryKey(vocabId, "write"))?.flagged ?? false)
  );
}

/** Flag for one specific track only — used where a "both"-skill word shows
 * up as two separate entries (one under 识读, one under 识写), each needing
 * its own flag state rather than isFlagged's either-track OR. */
export function isSkillFlagged(
  vocabId: string,
  skill: "read" | "write",
  masteryByKey: Map<MasteryKey, RevisionMastery>
): boolean {
  return masteryByKey.get(masteryKey(vocabId, skill))?.flagged ?? false;
}

/** A word/track counts as "tricky" if it's explicitly flagged, has ever
 * been missed, or hasn't yet reached level 2 (passed its Level-1 test) —
 * used for the Test picker's "tricky words only" mode and mirrored from
 * the equivalent local check on the Progress page (ZooClient.tsx). */
export function isTricky(
  vocabId: string,
  skill: "read" | "write",
  masteryByKey: Map<MasteryKey, RevisionMastery>
): boolean {
  const m = masteryByKey.get(masteryKey(vocabId, skill));
  return (m?.flagged ?? false) || (m?.misses ?? 0) > 0 || (m?.level ?? 0) < 2;
}

/** Chapter-level stage badge: fraction of this chapter's words that are
 * individually mastered (every required track at level 3), bucketed into
 * the same 4-stage set as a single word — 0% -> 🥚, <50% -> 🐣, <100% -> 🐥,
 * 100% -> 🐔. Mirrors the "mastered = passed Level 2" rule from the design
 * review rather than averaging raw per-track percentages, which would
 * overstate a chapter where every word is half-done on one track only. */
export function chapterStage(words: RevisionVocab[], masteryByKey: Map<MasteryKey, RevisionMastery>): number {
  if (words.length === 0) return 0;
  const masteredCount = words.filter((w) => isWordMastered(w, masteryByKey)).length;
  const pct = masteredCount / words.length;
  if (pct >= 1) return 3;
  if (pct > 0) return pct >= 0.5 ? 2 : 1;
  return 0;
}

/** Per-skill (识读/识写) progress counts for a chapter, e.g. for the
 * "识读 11/18 · 识写 4/11" summary line — total is how many of this
 * chapter's words require that skill at all, mastered is how many have
 * reached level 3 on it. */
export function skillProgress(
  words: RevisionVocab[],
  skill: "read" | "write",
  masteryByKey: Map<MasteryKey, RevisionMastery>
): { mastered: number; total: number } {
  const eligible = words.filter((w) => tracksFor(w.skill).includes(skill));
  const mastered = eligible.filter((w) => (masteryByKey.get(masteryKey(w.id, skill))?.level ?? 0) >= 3).length;
  return { mastered, total: eligible.length };
}

/** Monday of the current week in Asia/Singapore — duplicated from
 * app/kid/[childId]/page.tsx's local currentMondaySGT() rather than
 * exporting it from that (TingXie) file. */
export function currentMondaySGT(): string {
  const sgtShifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const day = sgtShifted.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  sgtShifted.setUTCDate(sgtShifted.getUTCDate() - diffToMonday);
  return sgtShifted.toISOString().slice(0, 10);
}

/** Distinct vocab words touched (any skill) since Monday — "words", not
 * characters: a mastery row exists per vocab item regardless of how many
 * characters that word has, so 新闻 (2 chars) and 阅读新闻起来 (hypothetical
 * 6-char item) would each count once. */
export function weeklyReviewedCount(rows: RevisionMastery[]): number {
  const monday = currentMondaySGT();
  const seen = new Set<string>();
  for (const m of rows) {
    if (m.last_seen && m.last_seen.slice(0, 10) >= monday) seen.add(m.vocab_id);
  }
  return seen.size;
}
