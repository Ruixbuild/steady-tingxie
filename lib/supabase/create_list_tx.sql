-- M2: atomic list+sections+items creation, per handoff spec §3.
-- Run this once in the Supabase SQL Editor.
create or replace function create_list_tx(
  child_id uuid,
  name text,
  test_date date,
  source text,
  sections_json jsonb
) returns uuid
language plpgsql
security invoker
as $$
-- #variable_conflict use_column: lists' and mastery's RLS policies each
-- reference a bare, unqualified child_id in their USING/WITH CHECK clauses;
-- since this function's own parameter is also named child_id, that's
-- ambiguous (42702) the moment either insert below gets row-security-checked.
-- Same fix as record_test_attempt.sql/record_item_progress.sql.
#variable_conflict use_column
declare
  v_list_id uuid;
  v_section jsonb;
  v_section_id uuid;
  v_item jsonb;
  v_item_id uuid;
begin
  insert into lists (child_id, name, test_date, source)
  values (
    create_list_tx.child_id,
    create_list_tx.name,
    create_list_tx.test_date,
    coalesce(create_list_tx.source, 'manual')
  )
  returning id into v_list_id;

  for v_section in select * from jsonb_array_elements(sections_json)
  loop
    insert into sections (list_id, kind, title, pick_n, ord)
    values (
      v_list_id,
      v_section->>'kind',
      v_section->>'title',
      nullif(v_section->>'pick_n', '')::int,
      coalesce((v_section->>'ord')::smallint, 0)
    )
    returning id into v_section_id;

    for v_item in select * from jsonb_array_elements(coalesce(v_section->'items', '[]'::jsonb))
    loop
      insert into items (section_id, ord, hanzi, pinyin, english, ocr_confidence)
      values (
        v_section_id,
        (v_item->>'ord')::smallint,
        v_item->>'hanzi',
        v_item->>'pinyin',
        v_item->>'english',
        nullif(v_item->>'ocr_confidence', '')::real
      )
      returning id into v_item_id;

      insert into mastery (child_id, item_id, level)
      values (create_list_tx.child_id, v_item_id, 0);
    end loop;
  end loop;

  insert into events (user_id, event) values (auth.uid(), 'list_created');

  return v_list_id;
end;
$$;

grant execute on function create_list_tx(uuid, text, date, text, jsonb) to authenticated;
