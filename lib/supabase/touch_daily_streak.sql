-- M4: shared streak/grace-day helper, extracted from record_set_complete (M3)
-- so both Learn set-completion and Test attempt-completion use one implementation.
-- Run this once in the Supabase SQL Editor.
create or replace function touch_daily_streak(
  child_id uuid,
  summary text default null
) returns uuid -- parent_id
language plpgsql
security invoker
as $$
declare
  v_today date := (now() at time zone 'Asia/Singapore')::date;
  v_parent_id uuid;
begin
  update children c set
    streak = case
      when c.last_set_done is null then 1
      when c.last_set_done = v_today then c.streak
      when c.last_set_done = v_today - 1 then c.streak + 1
      when c.last_set_done = v_today - 2 and not c.streak_grace_used then c.streak + 1
      else 1
    end,
    streak_grace_used = case
      when c.last_set_done = v_today - 2 and not c.streak_grace_used then true
      else c.streak_grace_used
    end,
    last_set_done = v_today,
    last_summary = coalesce(touch_daily_streak.summary, c.last_summary),
    last_active = now()
  where c.id = touch_daily_streak.child_id
  returning c.parent_id into v_parent_id;

  return v_parent_id;
end;
$$;

grant execute on function touch_daily_streak(uuid, text) to authenticated;
