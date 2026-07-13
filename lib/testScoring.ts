// Flat scoring + prediction, per handoff spec §2.

export const PASSAGE_PUNCTUATION = new Set(["，", "。", "！", "？", "；", "、"]);

/** Global (punctuation-included) positions of the scoreable, non-punctuation chars in a passage. */
export function passageQuizPositions(hanzi: string): number[] {
  const positions: number[] = [];
  Array.from(hanzi).forEach((ch, i) => {
    if (!PASSAGE_PUNCTUATION.has(ch)) positions.push(i);
  });
  return positions;
}

/** Char pass threshold: hanzi-writer quiz totalMistakes must be <= this to pass. */
export function charMistakeThreshold(strokes: number, hardMode: boolean): number {
  const base = Math.max(2, Math.ceil(strokes * 0.4));
  return hardMode ? Math.ceil(base * 0.25) : base;
}

export const MASTERY_WEIGHT = [0.15, 0.45, 0.75, 0.97] as const;

export function predictedPct(input: {
  nonPassageLevels: number[];
  passageCharMissed: boolean[];
}): number {
  const weights: number[] = [];
  for (const level of input.nonPassageLevels) {
    const clamped = Math.max(0, Math.min(3, level));
    weights.push(MASTERY_WEIGHT[clamped]);
  }
  for (const missed of input.passageCharMissed) {
    weights.push(missed ? 0.3 : 0.75);
  }
  if (weights.length === 0) return 0;
  const sum = weights.reduce((a, b) => a + b, 0);
  return Math.round((100 * sum) / weights.length);
}

/** tricky(child,list) = non-passage items where level<2 OR misses>0, per §9. */
export function isTricky(kind: "words" | "pinyin" | "passage", level: number, misses: number): boolean {
  return kind !== "passage" && (level < 2 || misses > 0);
}
