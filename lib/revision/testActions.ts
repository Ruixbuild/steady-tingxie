"use client";

// Client-side call into record_revision_word_attempt (lib/supabase/revision_test.sql).
// Parallel to masteryActions.ts's touchMastery, but for a graded Test
// attempt rather than a bare Learn-exposure touch.

import { createClient } from "@/lib/supabase/client";

export type CharResult = { strokes: number; total_mistakes: number };

type RpcResult = { new_level: number; item_passed: boolean };

/** Submits one word's test attempt and returns the graded result.
 * - skill "read": pass `passed` (client-determined — a selection-based
 *   quiz's correctness can't be faked in a way that matters, same trust
 *   level TingXie gives its own pinyin items).
 * - skill "write": pass `charResults` (raw per-character strokes/mistakes)
 *   — the RPC computes pass/fail server-side from these, not from a
 *   client-reported verdict. */
export async function submitWordAttempt(
  childId: string,
  vocabId: string,
  skill: "read" | "write",
  testLevel: 1 | 2,
  result: { passed?: boolean; charResults?: CharResult[] }
): Promise<RpcResult> {
  const supabase = createClient();
  // record_revision_word_attempt isn't in the shared Database generic (same
  // reason revision_mastery's upsert needed a cast in masteryActions.ts) —
  // supabase-js's rpc() only accepts known function names otherwise.
  //
  // Cast inline and call .rpc() directly on the casted expression, rather
  // than extracting `supabase.rpc` into a standalone variable first: that
  // detaches the method from its object, so calling it later as a bare
  // function loses its `this` binding — supabase-js's internals reference
  // `this.rest` inside .rpc(), so a detached call throws "undefined is not
  // an object (evaluating 'this.rest')" every time, which is exactly what
  // silently broke every Revision test-mastery write until this fix.
  const { data, error } = await (
    supabase as unknown as {
      rpc: (fn: string, args: object) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("record_revision_word_attempt", {
    child_id: childId,
    vocab_id: vocabId,
    skill,
    test_level: testLevel,
    passed: result.passed ?? null,
    char_results: result.charResults ?? null,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as RpcResult;
  return row;
}
