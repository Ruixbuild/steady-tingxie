"use client";

// Client-side writes to revision_mastery. A single-table upsert, so this
// goes straight through the browser Supabase client rather than an RPC —
// TingXie's RPC-only rule (see lib/supabase/*.sql) is for writes that touch
// multiple tables atomically, which this isn't.

import { createClient } from "@/lib/supabase/client";

type ExistingMasteryRow = { level: number; flagged: boolean };

/** Records review exposure for one (child, vocab, skill) track: bumps
 * `level` to at least 1 (first-exposure signal — Test is what raises it
 * further) and stamps `last_seen` now, for the weekly-reviewed count and
 * chapter mastery badges. Pass `opts.flagged` to also set the attention
 * flag; omitted, the existing flagged value (or false) is preserved. */
export async function touchMastery(
  childId: string,
  vocabId: string,
  skill: "read" | "write",
  opts?: { flagged?: boolean }
): Promise<void> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("revision_mastery")
    .select("level, flagged")
    .eq("child_id", childId)
    .eq("vocab_id", vocabId)
    .eq("skill", skill)
    .maybeSingle();
  const existingRow = existing as unknown as ExistingMasteryRow | null;

  // revision_mastery isn't in the shared Database generic (see
  // lib/revision/types.ts's header note) — supabase-js types an insert/
  // upsert payload against an undeclared table as `never`, unlike select,
  // which stays permissive. Cast the table handle itself for the write.
  await (supabase.from("revision_mastery") as unknown as { upsert: (row: object, opts: object) => Promise<unknown> }).upsert(
    {
      child_id: childId,
      vocab_id: vocabId,
      skill,
      level: Math.max(existingRow?.level ?? 0, 1),
      flagged: opts?.flagged ?? existingRow?.flagged ?? false,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "child_id,vocab_id,skill" }
  );
}
