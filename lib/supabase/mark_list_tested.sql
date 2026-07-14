-- M8: snapshot predicted%/actual score at "Mark as tested" time.
-- predicted_pct is computed client-side via the same lib/testScoring.ts
-- used everywhere else (test picker, Focus, Reports) and passed in here
-- rather than recomputed in SQL, to avoid duplicating that logic in a
-- second language.
-- Run this once in the Supabase SQL Editor.
create or replace function mark_list_tested(
  list_id uuid,
  predicted_pct int,
  actual_score int,
  actual_total int
) returns void
language plpgsql
security invoker
as $$
begin
  update lists set
    status = 'tested',
    predicted_at_test = mark_list_tested.predicted_pct,
    actual_score = mark_list_tested.actual_score,
    actual_total = mark_list_tested.actual_total
  where id = mark_list_tested.list_id;
end;
$$;

grant execute on function mark_list_tested(uuid, int, int, int) to authenticated;
