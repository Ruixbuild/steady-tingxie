// Shared between the per-item test components, TestSession, and the
// record_test_attempt RPC call. Word/passage pass-fail is decided
// server-side from raw stroke/mistake counts, not trusted from the client.
export type CharMistakes = {
  strokes: number;
  totalMistakes: number;
  /** True when the child tapped "Skip this one" rather than actually
   * writing the character — neutral in scoring: doesn't count as a miss
   * (so it can't drag a known word down to "weak") but also isn't
   * recorded as a pass, since nothing was actually demonstrated. See
   * record_test_attempt.sql for how this is handled server-side. */
  skipped?: boolean;
};

export type ItemResult =
  | { item_id: string; kind: "words"; chars: CharMistakes[] }
  | { item_id: string; kind: "pinyin"; passed: boolean }
  | {
      item_id: string;
      kind: "passage";
      chars: (CharMistakes & { globalIndex: number })[];
    };
