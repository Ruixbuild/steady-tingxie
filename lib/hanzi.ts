// CJK ideograph range — chars with real stroke data in hanzi-writer-data.
const CJK_RE = /[一-鿿]/;

// Chinese punctuation has no stroke data — hanzi-writer-data has nothing to
// load for it and would crash the ladder/quiz if asked to. It's still a
// scoreable "character" in learn/test (per §punctuation), just rendered as
// a plain recognize-and-continue step instead of a stroke writer.
export const PUNCTUATION_RE = /[，。！？；、]/;

export function isPunctuationChar(char: string): boolean {
  return PUNCTUATION_RE.test(char);
}

export function isStrokeChar(char: string): boolean {
  return CJK_RE.test(char) || isPunctuationChar(char);
}

export function strokeChars(hanzi: string): string[] {
  return Array.from(hanzi).filter(isStrokeChar);
}
