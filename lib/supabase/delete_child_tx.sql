-- Deletes a child profile and all dependent rows, in one transaction.
-- Most child-referencing tables (mastery, lists, attempts, sessions,
-- tree_growths) already cascade automatically on delete — confirmed via:
--   select conrelid::regclass, conname, confdeltype from pg_constraint
--     where confrelid = 'children'::regclass and contype = 'f';
-- Three Revision-feature tables (revision_attempts, revision_mastery,
-- revision_assignments) use NO ACTION instead, so a plain
-- `delete from children` fails with a foreign-key violation (23503) the
-- moment any Revision data exists for that child. This explicitly clears
-- those three first, then deletes the child row — it doesn't touch any
-- existing Revision logic/schema, it just respects that data when a
-- parent deletes a child profile (a core, non-Revision action).
-- Run this once in the Supabase SQL Editor.
create or replace function delete_child_tx(child_id uuid)
returns void
language plpgsql
security invoker
as $$
-- #variable_conflict use_column: same rationale as record_test_attempt.sql
-- — these tables' RLS policies reference a bare, unqualified child_id,
-- which is ambiguous against this function's own child_id parameter.
#variable_conflict use_column
begin
  delete from revision_attempts where revision_attempts.child_id = delete_child_tx.child_id;
  delete from revision_mastery where revision_mastery.child_id = delete_child_tx.child_id;
  delete from revision_assignments where revision_assignments.child_id = delete_child_tx.child_id;
  delete from children where children.id = delete_child_tx.child_id;
end;
$$;

grant execute on function delete_child_tx(uuid) to authenticated;
