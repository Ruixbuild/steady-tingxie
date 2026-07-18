// CJK ideograph range — used to skip punctuation (，。！？、 etc.) when building
// stroke-practice queues, since hanzi-writer-data has no stroke data for them
// and trying to load it crashes the ladder/quiz.
const CJK_RE = /[一-鿿]/;

export function isStrokeChar(char: string): boolean {
  return CJK_RE.test(char);
}

export function strokeChars(hanzi: string): string[] {
  return Array.from(hanzi).filter(isStrokeChar);
}
