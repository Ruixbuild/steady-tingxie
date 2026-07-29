// Revision's own narration helper. lib/narration.ts's PACING/AUTO_ANNOUNCE
// tables are closed to TingXie's own ItemKind/Surface unions and shouldn't
// be extended (per CLAUDE.md's Revision guardrails) — Revision speaks
// through lib/tts.ts directly instead. lib/tts.ts's namePunctuation() spells
// out Chinese punctuation by name (，-> "逗号") so a 默写 test-taker can hear
// where a mark belongs — useful for TingXie's dictation accuracy, not for
// Revision's definitions/sentences/pairings, which just read as text with
// stray "逗号"/"句号" spoken mid-sentence. Strip punctuation before handing
// text to speak() or to CharLadder's word/announceWord props.

import { PUNCTUATION_CHARS } from "@/lib/hanzi";
import { speak } from "@/lib/tts";

const STRIP_RE = new RegExp(`[${PUNCTUATION_CHARS.join("")}]`, "g");

export function stripPunctuation(text: string): string {
  return text.replace(STRIP_RE, "");
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
 * otherwise untouched. */
export function speakRevision(text: string): void {
  speak(stripPunctuation(text), "zh-CN", REVISION_RATE);
}
