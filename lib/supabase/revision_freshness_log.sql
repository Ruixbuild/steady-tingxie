-- revision_freshness_log.sql
-- APPLY MANUALLY in Supabase SQL Editor, after revision_schema.sql.
--
-- Logs every (vocab_id, skill) pair the vocab hub's "Keep it fresh" sampler
-- has offered a child, independent of whether that practice session was
-- ever completed -- logged at sample time (app/kid/[childId]/vocab/fresh/
-- page.tsx), not completion time, specifically so an abandoned or
-- repeatedly-tapped "Keep it fresh" doesn't keep re-offering the same
-- handful of stale words. lib/revision/freshness.ts's sampleFreshPairs
-- excludes any pair logged within the last FRESHNESS_STALE_DAYS from the
-- eligible pool, so repeated taps rotate through the whole stale set
-- instead of converging on the same words every time.
--
-- Deliberately one row per (child, vocab, skill, sampled_at) rather than
-- one row per session with a jsonb array (contrast revision_attempts,
-- which records score/results for actual history display) -- the only
-- thing this table is ever queried for is "was this vocab+skill offered
-- recently", which a flat row makes a plain indexed range query instead of
-- needing to unnest jsonb across every recent session row. A completed
-- freshness session still gets its own revision_attempts row via the
-- normal record_revision_test_attempt path (chapter_number null, same as
-- the cross-chapter tricky-words session) -- this table is purely the
-- sampler's own memory, not a user-facing history.

create table revision_freshness_log(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  vocab_id uuid not null,
  skill text not null check(skill in('read','write')),
  sampled_at timestamptz not null default now()
);
create index on revision_freshness_log(child_id, sampled_at desc);

alter table revision_freshness_log enable row level security;

-- Predicate copied verbatim from revision_mastery's / revision_attempts's
-- policy.
create policy "p_revision_freshness_log" on revision_freshness_log
  for all to authenticated
  using(child_id in(select id from children where parent_id=auth.uid()))
  with check(child_id in(select id from children where parent_id=auth.uid()));
