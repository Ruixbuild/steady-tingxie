-- M3: race-safe per-item mastery/XP update, per handoff spec §7.2.
-- Run this once in the Supabase SQL Editor.
create or replace function record_item_progress(
  child_id uuid,
  item_id uuid,
  chars_written int,
  trace_svg text default null
) returns int -- new xp
language plpgsql
security invoker
as $$
-- #variable_conflict use_column: the mastery table's RLS policy references a
-- bare, unqualified child_id in its USING/WITH CHECK clause; since this
-- function's own parameter is also named child_id, that's ambiguous (42702)
-- between the column and the parameter the moment this update gets
-- row-security-checked. Same fix as record_test_attempt.sql.
#variable_conflict use_column
declare
  v_monday date := date_trunc('week', (now() at time zone 'Asia/Singapore')::date)::date;
  v_new_xp int;
begin
  update mastery m set
    level = greatest(m.level, 2),
    pinned = false,
    last_seen = now(),
    last_trace_svg = case
      when record_item_progress.trace_svg is not null
           and length(record_item_progress.trace_svg) <= 8192
      then record_item_progress.trace_svg
      else m.last_trace_svg
    end
  where m.child_id = record_item_progress.child_id
    and m.item_id = record_item_progress.item_id;

  update children c set
    xp = c.xp + (record_item_progress.chars_written * 2),
    chars_written_week = case
      when c.chars_week_start is distinct from v_monday
      then record_item_progress.chars_written
      else c.chars_written_week + record_item_progress.chars_written
    end,
    chars_week_start = v_monday,
    last_active = now()
  where c.id = record_item_progress.child_id
  returning c.xp into v_new_xp;

  return v_new_xp;
end;
$$;

grant execute on function record_item_progress(uuid, uuid, int, text) to authenticated;
