// Shared between the per-item test components, TestSession, and the
// record_test_attempt RPC call. Word/passage pass-fail is decided
// server-side from raw stroke/mistake counts, not trusted from the client.
export type CharMistakes = { strokes: number; totalMistakes: number };

export type ItemResult =
  | { item_id: string; kind: "words"; chars: CharMistakes[] }
  | { item_id: string; kind: "pinyin"; passed: boolean }
  | {
      item_id: string;
      kind: "passage";
      chars: (CharMistakes & { globalIndex: number })[];
    };
