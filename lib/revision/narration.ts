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

const STRIP_RE = new RegExp(`[${PUNCTUATION_CHARS.join("")}]`, "g");

export function stripPunctuation(text: string): string {
  return text.replace(STRIP_RE, "");
}
