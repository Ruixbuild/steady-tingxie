"use client";

// Client-side call into record_revision_test_attempt (lib/supabase/
// revision_attempts.sql). Sibling to testActions.ts's submitWordAttempt,
// but persists the whole finished run as one row instead of touching
// per-word mastery — called once, when TestRunner's queue empties, not
// per word.

import { createClient } from "@/lib/supabase/client";

export type AttemptWordResult = { vocabId: string; hanzi: string; passed: boolean };

/** Persists one completed Test run (one skill+level session) as a single
 * revision_attempts row. Returns the new attempt id. */
export async function recordTestAttempt(
  childId: string,
  chapterNumber: number,
  skill: "read" | "write",
  testLevel: 1 | 2,
  results: AttemptWordResult[]
): Promise<string> {
  const supabase = createClient();
  // record_revision_test_attempt isn't in the shared Database generic, same
  // reason submitWordAttempt's rpc() call needed a cast.
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: object
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("record_revision_test_attempt", {
    child_id: childId,
    chapter_number: chapterNumber,
    skill,
    test_level: testLevel,
    results: results.map((r) => ({ vocab_id: r.vocabId, hanzi: r.hanzi, passed: r.passed })),
  });
  if (error) throw new Error(error.message);
  return data as string;
}
