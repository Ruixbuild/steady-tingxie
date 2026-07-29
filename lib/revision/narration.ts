// Revision's own narration helper. lib/narration.ts's PACING/AUTO_ANNOUNCE
// tables are closed to TingXie's own ItemKind/Surface unions and shouldn't
// be extended (per CLAUDE.md's Revision guardrails) — Revision speaks
// through lib/tts.ts directly instead. lib/tts.ts's namePunctuation() spells
// out Chinese punctuation by name (，-> "逗号") so a 默写 test-taker can hear
// where a mark belongs — useful for TingXie's dictation accuracy, not for
// Revision's definitions/sentences/pairings, which just read as text with
// stray "逗号"/"句号" spoken mid-sentence.

import { PUNCTUATION_CHARS, type PunctuationChar } from "@/lib/hanzi";
import { speak } from "@/lib/tts";

const STRIP_RE = new RegExp(`[${PUNCTUATION_CHARS.join("")}]`, "g");

/** Full removal — used for short vocab words (WriteCard's word/announceWord
 * props), which shouldn't contain sentence punctuation in the first place. */
export function stripPunctuation(text: string): string {
  return text.replace(STRIP_RE, "");
}

// Google's TTS engine relies on punctuation to find natural clause/sentence
// breaks — fully stripping it (the original approach here) removed those
// cues entirely, which is what made longer sentence/definition narration
// sound choppy and unnaturally segmented. But lib/tts.ts's namePunctuation()
// unconditionally spells out any of the full-width marks below by name
// (，-> "逗号"), which is exactly what Revision doesn't want mid-sentence.
// The fix is neither strip-all nor pass-through: swap each mark for its
// plain ASCII equivalent, which Google's engine still reads as a pause/
// sentence-boundary cue, but which namePunctuation's lookup (keyed only on
// the full-width chars) doesn't recognize, so it passes through unspoken.
const ASCII_PUNCTUATION: Record<PunctuationChar, string> = {
  "，": ",",
  "。": ".",
  "！": "!",
  "？": "?",
  "；": ";",
  "、": ",",
  "：": ":",
  "“": "",
  "”": "",
  "「": "",
  "」": "",
};

function naturalizePunctuation(text: string): string {
  return Array.from(text)
    .map((ch) => ASCII_PUNCTUATION[ch as PunctuationChar] ?? ch)
    .join("");
}

// Revision's fixed rate for all narration — one flat value, unlike
// TingXie's per-ItemKind PACING table.
const REVISION_RATE = 0.8;

/** Revision's one narration entry point — a control surface deliberately
 * separate from lib/narration.ts's PACING/AUTO_ANNOUNCE tables. Those exist
 * to slow speech down and insert artificial inter-clause pauses for TingXie's
 * dictation tests, where a child needs time to physically write each
 * character before the next one is read. Revision's audio (word/definition/
 * sentence playback) is read for comprehension, not transcribed under test
 * conditions, so there's no manual segmentation/pausing here — just a single
 * flat rate applied to the whole clip, with Google's own phrasing left
 * otherwise untouched — punctuation is naturalized (see
 * naturalizePunctuation above), not stripped, so clause/sentence pauses
 * still sound natural instead of run-on. */
export function speakRevision(text: string): void {
  speak(naturalizePunctuation(text), "zh-CN", REVISION_RATE);
}
