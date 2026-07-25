// THE single source of truth for how each item format is narrated on each
// screen. lib/tts.ts owns the mechanism (speak text at a rate, with a pause
// after each ，/。); this file owns every product decision about which rate
// and which pause a given format gets where.
//
// Why it's centralized: narration policy used to be restated at each of ~11
// call sites across Learn, Test and Reader, so feedback about one format or
// one screen got applied there and the other surfaces silently stayed
// behind — the Reader screen sat on two superseded implementations for
// exactly that reason. A later attempt to fix it by inferring the format
// from the text (does it contain punctuation → treat as mo xie) was worse:
// a ci yu can itself be a full punctuated sentence, so real ci yu items got
// misread as mo xie and given slow dictation pacing.
//
// So: never infer the format from the text. The caller knows the section
// kind — pass it in, and let the tables below decide.
//
// To change behaviour, edit one cell here and every screen follows.

import {
  DICTATION_RATE,
  WORD_RATE,
  prefetchPaced,
  speakChar,
  speakOpening,
  speakPaced,
} from "@/lib/tts";

/** Mirrors SectionKind — the three formats a parent can define.
 *  words   = ci yu 词语   — a 2-character word, a 4-character phrase, OR a
 *                           full sentence with punctuation.
 *  pinyin  = pinyin drill — hanzi shown, child types the romanization.
 *  passage = mo xie 默写  — full-sentence dictation, almost always
 *                           punctuated. */
export type ItemKind = "words" | "pinyin" | "passage";

/** Which screen is asking. Learn = stroke ladder practice, Test = graded
 *  attempt, Reader = the review/"Dictation" playback screen. */
export type Surface = "learn" | "test" | "reader";

type Pacing = { rate: number; pauseMs: number };

// A ci yu's own rate — deliberately separate from WORD_RATE (which pinyin
// still uses) so tuning one format's speed can't silently change the
// other's.
const CI_YU_RATE = 0.75;

// How fast, and how long a beat after each ，/。.
//
// Only mo xie gets the full writing pause: it's the format where the child
// writes from audio alone, so they need real time per clause. A ci yu gets a
// shorter beat — it reads as a natural sentence rather than a dictation, but
// still gives the child a moment to catch up on a long one. Because
// unpunctuated text is a single segment regardless, this one row covers all
// three ci yu shapes (2-char, 4-char, punctuated sentence) with no branching.
const PACING: Record<ItemKind, Pacing> = {
  words: { rate: CI_YU_RATE, pauseMs: 120 },
  pinyin: { rate: WORD_RATE, pauseMs: 0 },
  passage: { rate: DICTATION_RATE, pauseMs: 450 },
};

// Does the item speak by itself when the child arrives at it, without being
// asked?
//
// The one deliberate `false` among the writing formats is mo xie in Test:
// that's a blind dictation, so auto-playing it would hand the child the
// answer. Every other combination announces once on entry — pinyin
// announces on arrival in both Learn and Test, matching. Reader is entirely
// child-driven playback.
const AUTO_ANNOUNCE: Record<Surface, Record<ItemKind, boolean>> = {
  learn: { words: true, pinyin: true, passage: true },
  test: { words: true, pinyin: true, passage: false },
  reader: { words: false, pinyin: false, passage: false },
};

/** True when this screen deliberately stays silent until the child asks —
 * i.e. a blind test. Lets a component derive its own "silent" behaviour
 * from the table instead of hardcoding it. */
export function isSilentOnEntry(kind: ItemKind, surface: Surface): boolean {
  return !AUTO_ANNOUNCE[surface][kind];
}

/** Speak the item once on arrival, if policy says this format announces
 * itself on this screen. A no-op otherwise — callers don't need to check. */
export function announceOnEntry(kind: ItemKind, surface: Surface, text: string) {
  if (isSilentOnEntry(kind, surface)) return;
  const { rate, pauseMs } = PACING[kind];
  speakPaced(text, rate, pauseMs);
}

/** Speak the item because the child explicitly asked ("Say it again" /
 * "Read full sentence"). Always plays — the auto-announce policy doesn't
 * apply to a deliberate tap, which is what makes a blind mo xie test still
 * replayable on demand. */
export function replayItem(kind: ItemKind, text: string) {
  const { rate, pauseMs } = PACING[kind];
  speakPaced(text, rate, pauseMs);
}

/** Speak only the opening `count` characters — the harder "read first 2
 * words" hint, at the same rate the full item would use. */
export function replayItemOpening(kind: ItemKind, text: string, count: number) {
  speakOpening(text, count, PACING[kind].rate);
}

/** A single character on its own, e.g. tapping one char in the Reader to
 * hear it. Rate is per-character, not per-format. */
export function replayChar(char: string) {
  speakChar(char);
}

/** Warm this item's audio so the child's first tap plays instantly instead
 * of waiting on a cold /api/tts round-trip.
 *
 * Worth calling on entry for exactly the silent-by-default cases: a blind
 * mo xie test never auto-plays, but the child is very likely to tap "read
 * full sentence" within a second or two, and that tap is currently the
 * slowest moment in the flow. Where the item does auto-announce, playback
 * already populates the same cache, so prefetching would be redundant. */
export function prefetchItem(kind: ItemKind, surface: Surface, text: string) {
  if (!isSilentOnEntry(kind, surface)) return;
  prefetchPaced(text, PACING[kind].rate);
}
