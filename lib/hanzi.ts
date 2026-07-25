// CJK ideograph range — chars with real stroke data in hanzi-writer-data.
const CJK_RE = /[一-鿿]/;

// THE canonical list of Chinese punctuation this app understands. Everything
// punctuation-related downstream derives from this one array — the
// stroke-exclusion regex below, lib/testScoring's PASSAGE_PUNCTUATION
// (scoring + tricky-char underlining), and lib/tts's PUNCTUATION_NAMES
// (spelling each mark aloud). Add a mark HERE and only here: the names map
// is typed against this array, so a mark with no spoken name is a
// compile error rather than a mark that silently never gets narrated.
//
// Chinese punctuation has no stroke data — hanzi-writer-data has nothing to
// load for it and would crash the ladder/quiz if asked to. It's still a
// scoreable "character" in learn/test (per §punctuation), just rendered as
// a plain recognize-and-continue step instead of a stroke writer.
export const PUNCTUATION_CHARS = [
  "，", "。", "！", "？", "；", "、", "：", "“", "”", "「", "」",
] as const;

export type PunctuationChar = (typeof PUNCTUATION_CHARS)[number];

const PUNCTUATION_SET: ReadonlySet<string> = new Set(PUNCTUATION_CHARS);

// Derived, not hand-maintained. Safe to build by concatenation because no
// mark above is a regex metacharacter (and none can be — they're all CJK
// punctuation); revisit if that ever stops being true.
export const PUNCTUATION_RE = new RegExp(`[${PUNCTUATION_CHARS.join("")}]`);

export function isPunctuationChar(char: string): boolean {
  return PUNCTUATION_SET.has(char);
}

// Deliberately NOT provided here: a "does this text contain punctuation?"
// helper. It reads like a way to detect a mo xie passage, and was used that
// way to pick narration pacing — but a ci yu can itself be a full punctuated
// sentence, so that inference silently misclassified real items. Narration
// pacing is chosen from the item's section kind instead; see lib/narration.

export function isStrokeChar(char: string): boolean {
  return CJK_RE.test(char) || isPunctuationChar(char);
}

export function strokeChars(hanzi: string): string[] {
  return Array.from(hanzi).filter(isStrokeChar);
}
