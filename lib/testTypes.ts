// Shared between the per-item test components, TestSession, and the
// record_test_attempt RPC call.
export type ItemResult =
  | { item_id: string; kind: "words" | "pinyin"; passed: boolean }
  | { item_id: string; kind: "passage"; totalChars: number; missedPositions: number[] };
