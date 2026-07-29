-- revision_test.sql
-- APPLY MANUALLY in Supabase SQL Editor, after revision_schema.sql.
-- Vocabulary Revision's own grading RPC. Not a reuse/extension of TingXie's
-- record_test_attempt.sql -- that function is tightly coupled to TingXie's
-- items/lists/attempts/tree_growths tables and has no Revision-shaped
-- equivalent (Revision has no attempts/tree_growths tables at all, and its
-- mastery model is per (child, vocab, skill) rather than per item). This
-- function mirrors record_test_attempt's per-character grading formula and
-- pass/fail level semantics, applied fresh against revision_mastery.
--
-- Trust model (mirrors TingXie's own split): a 识写 (write) attempt reports
-- raw {strokes, total_mistakes} per character and is graded HERE, server
-- side, from the same threshold formula TingXie uses for its 'words'/
-- 'passage' items -- a child's browser can't fake a passing grade by lying
-- about the verdict. A 识读 (read) attempt is selection-based (the child
-- taps one of several options), so the client-reported `passed` boolean is
-- trusted directly -- the same trust level TingXie already gives its own
-- 'pinyin' items.
--
-- Level semantics: test_level is 1 or 2 (which format the child took).
-- Pass -> level becomes at least test_level + 1 (so passing the Level-2
-- test reaches level 3, i.e. "mastered" per lib/revision/mastery.ts's
-- isWordMastered). A pass never demotes an already-higher level. Fail ->
-- level drops by one (floor 1, since the word has still been seen at least
-- once via Learn) -- this is deliberate regression, matching TingXie's own
-- "a miss makes it tricky again" model, and is what lets Revision's
-- recency/attention-flag tracking stay meaningful over time.

create or replace function record_revision_word_attempt(
  child_id uuid,
  vocab_id uuid,
  skill text,
  test_level int,
  passed boolean default null,
  char_results jsonb default null
) returns table(new_level int, item_passed boolean)
language plpgsql
security invoker
as $$
#variable_conflict use_column
declare
  v_passed boolean;
  v_current_level int;
  v_current_misses int;
  v_prev_fail boolean;
  v_new_level int;
  v_char jsonb;
  v_strokes int;
  v_total_mistakes int;
  v_base int;
begin
  if skill not in ('read', 'write') then
    raise exception 'record_revision_word_attempt: skill must be read or write, got %', skill;
  end if;
  if test_level not in (1, 2) then
    raise exception 'record_revision_word_attempt: test_level must be 1 or 2, got %', test_level;
  end if;

  if skill = 'write' then
    v_passed := true;
    for v_char in select * from jsonb_array_elements(coalesce(char_results, '[]'::jsonb)) loop
      v_strokes := coalesce((v_char->>'strokes')::int, 10);
      v_total_mistakes := coalesce((v_char->>'total_mistakes')::int, 999);
      v_base := greatest(2, ceil(v_strokes * 0.4));
      if v_total_mistakes > v_base then
        v_passed := false;
      end if;
    end loop;
  else
    v_passed := coalesce(passed, false);
  end if;

  select level, misses, prev_fail
    into v_current_level, v_current_misses, v_prev_fail
    from revision_mastery
    where revision_mastery.child_id = record_revision_word_attempt.child_id
      and revision_mastery.vocab_id = record_revision_word_attempt.vocab_id
      and revision_mastery.skill = record_revision_word_attempt.skill;
  v_current_level := coalesce(v_current_level, 0);
  v_current_misses := coalesce(v_current_misses, 0);
  v_prev_fail := coalesce(v_prev_fail, false);

  if v_passed then
    v_new_level := greatest(v_current_level, test_level + 1);
  else
    v_new_level := greatest(1, v_current_level - 1);
  end if;

  insert into revision_mastery (child_id, vocab_id, skill, level, misses, prev_fail, improved, flagged, last_seen)
  values (
    record_revision_word_attempt.child_id,
    record_revision_word_attempt.vocab_id,
    record_revision_word_attempt.skill,
    v_new_level,
    case when v_passed then 0 else v_current_misses + 1 end,
    not v_passed,
    v_passed and v_prev_fail,
    false,
    now()
  )
  on conflict (child_id, vocab_id, skill) do update set
    level = excluded.level,
    misses = excluded.misses,
    prev_fail = excluded.prev_fail,
    improved = excluded.improved,
    last_seen = excluded.last_seen;

  return query select v_new_level, v_passed;
end;
$$;

grant execute on function record_revision_word_attempt(uuid, uuid, text, int, boolean, jsonb) to authenticated;
