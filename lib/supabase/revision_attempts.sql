-- revision_attempts.sql
-- APPLY MANUALLY in Supabase SQL Editor, after revision_schema.sql and
-- revision_test.sql.
--
-- Persists one row per completed Test run (one skill+level picker session,
-- e.g. "识读 Level 1" or "识写 Level 2"), not per word -- mirrors the grain
-- of TingXie's own `attempts` table. This is additive alongside
-- record_revision_word_attempt (revision_test.sql), which keeps updating
-- revision_mastery per word in real time as the child answers; this new
-- RPC is called once, when the whole run finishes, purely to persist a
-- history a child/parent can look back on -- nothing currently does that,
-- since TestRunner's in-memory results array is discarded on refresh.
--
-- Note: delete_child_tx.sql already references this table name (leftover
-- from an earlier abandoned Revision attempt, before this table existed --
-- see revision_schema.sql's header comment). This file makes that
-- reference valid; see the accompanying fix to delete_child_tx.sql itself
-- for the other (dangling, unbuilt-feature) table it referenced.

create table revision_attempts(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  chapter_number int not null,
  skill text not null check(skill in('read','write')),
  test_level int not null check(test_level in(1,2)),
  score int not null,
  total int not null,
  detail jsonb not null default '{}'::jsonb, -- {"words":[{vocab_id,hanzi,passed}, ...]}
  taken_at timestamptz not null default now()
);
create index on revision_attempts(child_id, chapter_number, taken_at desc);

alter table revision_attempts enable row level security;

-- Predicate copied verbatim from revision_mastery's policy.
create policy "p_revision_attempts" on revision_attempts
  for all to authenticated
  using(child_id in(select id from children where parent_id=auth.uid()))
  with check(child_id in(select id from children where parent_id=auth.uid()));

-- ============================================================
-- RPC
-- ============================================================

create or replace function record_revision_test_attempt(
  child_id uuid,
  chapter_number int,
  skill text,
  test_level int,
  results jsonb
) returns uuid
language plpgsql
security invoker
as $$
#variable_conflict use_column
declare
  v_score int;
  v_total int;
  v_id uuid;
begin
  if skill not in ('read', 'write') then
    raise exception 'record_revision_test_attempt: skill must be read or write, got %', skill;
  end if;
  if test_level not in (1, 2) then
    raise exception 'record_revision_test_attempt: test_level must be 1 or 2, got %', test_level;
  end if;

  select count(*) filter (where (elem->>'passed')::boolean), count(*)
    into v_score, v_total
    from jsonb_array_elements(coalesce(results, '[]'::jsonb)) as elem;

  insert into revision_attempts (child_id, chapter_number, skill, test_level, score, total, detail)
  values (
    record_revision_test_attempt.child_id,
    record_revision_test_attempt.chapter_number,
    record_revision_test_attempt.skill,
    record_revision_test_attempt.test_level,
    coalesce(v_score, 0),
    coalesce(v_total, 0),
    jsonb_build_object('words', coalesce(results, '[]'::jsonb))
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function record_revision_test_attempt(uuid, int, text, int, jsonb) to authenticated;
