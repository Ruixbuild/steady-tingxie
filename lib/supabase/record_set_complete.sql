-- M3: streak/grace/last_summary update + 'session' event, per handoff spec §7.1/§9.
-- Run this once in the Supabase SQL Editor.
create or replace function record_set_complete(
  child_id uuid,
  list_id uuid,
  items_count int
) returns void
language plpgsql
security invoker
as $$
declare
  v_today date := (now() at time zone 'Asia/Singapore')::date;
  v_list_name text;
  v_summary text;
begin
  select l.name into v_list_name from lists l where l.id = record_set_complete.list_id;
  v_summary := items_count || ' items practised · ' || coalesce(v_list_name, '');

  with upd as (
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
      last_summary = v_summary,
      last_active = now()
    where c.id = record_set_complete.child_id
    returning c.parent_id
  )
  insert into events (user_id, event) select parent_id, 'session' from upd;
end;
$$;

grant execute on function record_set_complete(uuid, uuid, int) to authenticated;
