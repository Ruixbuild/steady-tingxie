// Vocabulary Revision's own types — deliberately not added to
// lib/supabase/types.ts's Database generic (that file is TingXie's shared
// query-typing surface; per CLAUDE.md's Revision guardrails, new Revision
// logic stays in new files rather than editing shared ones). Revision's
// Supabase queries select from "revision_vocab"/"revision_mastery" untyped
// and cast the result with `as unknown as X[]` — the same pattern already
// used for `sectionsRaw as unknown as SectionRaw[]` in list/[listId]/page.tsx
// and `growthsRaw as unknown as GrowthRow[]` in garden/page.tsx.

export type RevisionSkill = "read" | "write" | "both";

export type RevisionVocab = {
  id: string;
  primary_level: string;
  edition: string;
  chapter_number: number;
  chapter_title: string;
  sort: number;
  hanzi: string;
  pinyin: string;
  english: string;
  skill: RevisionSkill;
  is_higher_chinese: boolean;
  cn_definition: string;
  sentence_1: string;
  sentence_2: string;
  pairing_1: string | null;
  pairing_2: string | null;
  pairing_3: string | null;
  pairing_4: string | null;
};

/** One row per (child, vocab, skill) — only "read" or "write", never
 * "both": a word with skill "both" gets two independent rows. */
export type RevisionMastery = {
  child_id: string;
  vocab_id: string;
  skill: "read" | "write";
  level: number;
  misses: number;
  prev_fail: boolean;
  improved: boolean;
  flagged: boolean;
  last_seen: string | null;
};

export type ChapterSummary = {
  chapterNumber: number;
  chapterTitle: string;
  words: RevisionVocab[];
};

/** One row per completed Test run (revision_attempts.sql) — the whole
 * skill+level session's outcome, not a per-word row (that's what
 * RevisionMastery already tracks). `detail.words` mirrors what's sent to
 * record_revision_test_attempt. */
export type RevisionAttempt = {
  id: string;
  child_id: string;
  chapter_number: number;
  skill: "read" | "write";
  test_level: 1 | 2;
  score: number;
  total: number;
  detail: { words: { vocab_id: string; hanzi: string; passed: boolean }[] };
  taken_at: string;
};

/** children + the new higher_chinese column. lib/supabase/types.ts's
 * generated Child type doesn't know about that column (deliberately left
 * untouched — see the note at the top of this file), so any query selecting
 * it types its whole `data` result as SelectQueryError; callers cast the
 * raw result to this type right after fetching, same as RevisionVocab. */
export type RevisionChildRow = {
  id: string;
  name: string;
  level: string;
  emoji: string;
  streak: number;
  higher_chinese: boolean;
};
