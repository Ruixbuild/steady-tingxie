-- garden_tier_migration.sql
-- APPLY MANUALLY in Supabase SQL Editor, once, after garden_schema.sql.
-- Run this BEFORE re-applying record_test_attempt.sql and before
-- (re-)running garden_backfill.sql — both now call garden_tier().
--
-- Replaces the old random-per-(item,term) tree species with a difficulty
-- tier computed from the word itself, so longer/harder words visibly grow
-- into fruit instead of a plain tree:
--
--   P1-P3: tier 1 (tree) = words/词语 of 1-2 characters, or any pinyin item
--          tier 2 (fruit) = words of >2 characters, or any passage/默写
--   P4-P6: tier 1 (tree) = words/词语 up to 4 characters, or any pinyin item
--          tier 2 (fruit) = words of >4 characters, or any passage/默写
--
-- tree_type is repurposed from a 3-way species ('pine'/'blossom'/'fruit')
-- to a 2-way tier ('tree'/'fruit'). garden_tree_type() (the old random
-- species function) is dropped — nothing should call it after this runs.

drop function if exists garden_tree_type(text, text);

create or replace function garden_tier(p_level text, p_kind text, p_hanzi text)
returns text
language plpgsql
immutable
as $$
declare
  v_grade int := coalesce((substring(p_level from '[0-9]+'))::int, 6);
  v_threshold int := case when v_grade <= 3 then 2 else 4 end;
begin
  if p_kind = 'passage' then
    return 'fruit';
  elsif p_kind = 'pinyin' then
    return 'tree';
  elsif p_kind = 'words' and length(coalesce(p_hanzi, '')) > v_threshold then
    return 'fruit';
  else
    return 'tree';
  end if;
end;
$$;

-- Drop the old 3-species constraint FIRST — existing rows still hold
-- 'pine'/'blossom' values at this point, so adding the new ('tree','fruit')
-- constraint before the data below is remapped would reject them outright
-- (that's the exact error this migration hit on first run: "check
-- constraint ... is violated by some row"). Default constraint name for an
-- inline `check(...)` on this column — if the drop is a no-op because the
-- name differs, run
-- `select conname from pg_constraint where conrelid = 'tree_growths'::regclass;`
-- to find the actual name and substitute it below.
alter table tree_growths drop constraint if exists tree_growths_tree_type_check;

-- Recompute tree_type for every already-grown tree (real usage +
-- garden_backfill.sql runs so far) so existing gardens reflect the new
-- tier logic instead of the old random species. Runs with no check
-- constraint in place, so the old 'pine'/'blossom'/'fruit' values don't
-- block the rewrite.
update tree_growths tg
set tree_type = garden_tier(c.level, s.kind, i.hanzi)
from children c, items i, sections s
where tg.child_id = c.id
  and tg.item_id = i.id
  and i.section_id = s.id;

-- Now that every row holds a valid new-tier value, it's safe to enforce it.
alter table tree_growths add constraint tree_growths_tree_type_check
  check (tree_type in ('tree', 'fruit'));
