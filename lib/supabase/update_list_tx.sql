-- M8: mastery-preserving list editor ("reopen editor"). Reconciles
-- sections/items against an existing list rather than replacing them
-- wholesale, so mastery rows for retained items survive an edit
-- (items/sections cascade-delete mastery, so a naive delete+recreate
-- would silently wipe a child's tracked progress).
-- Run this once in the Supabase SQL Editor.
create or replace function update_list_tx(
  list_id uuid,
  name text,
  test_date date,
  sections_json jsonb
) returns void
language plpgsql
security invoker
as $$
declare
  v_child_id uuid;
  v_incoming_section_ids uuid[];
  v_section jsonb;
  v_section_id uuid;
  v_incoming_item_ids uuid[];
  v_item jsonb;
  v_item_id uuid;
begin
  select child_id into v_child_id from lists where id = update_list_tx.list_id;

  update lists set
    name = update_list_tx.name,
    test_date = update_list_tx.test_date
  where id = update_list_tx.list_id;

  select array_agg((elem->>'id')::uuid) into v_incoming_section_ids
  from jsonb_array_elements(update_list_tx.sections_json) elem
  where elem->>'id' is not null;

  delete from sections
  where sections.list_id = update_list_tx.list_id
    and not (sections.id = any(coalesce(v_incoming_section_ids, '{}')));

  for v_section in select * from jsonb_array_elements(update_list_tx.sections_json) loop
    if v_section->>'id' is not null then
      v_section_id := (v_section->>'id')::uuid;
      update sections set
        kind = v_section->>'kind',
        title = v_section->>'title',
        pick_n = nullif(v_section->>'pick_n', '')::int,
        ord = coalesce((v_section->>'ord')::smallint, 0)
      where sections.id = v_section_id and sections.list_id = update_list_tx.list_id;
    else
      insert into sections (list_id, kind, title, pick_n, ord)
      values (
        update_list_tx.list_id,
        v_section->>'kind',
        v_section->>'title',
        nullif(v_section->>'pick_n', '')::int,
        coalesce((v_section->>'ord')::smallint, 0)
      )
      returning id into v_section_id;
    end if;

    select array_agg((elem->>'id')::uuid) into v_incoming_item_ids
    from jsonb_array_elements(coalesce(v_section->'items', '[]'::jsonb)) elem
    where elem->>'id' is not null;

    delete from items
    where section_id = v_section_id
      and not (id = any(coalesce(v_incoming_item_ids, '{}')));

    for v_item in select * from jsonb_array_elements(coalesce(v_section->'items', '[]'::jsonb)) loop
      if v_item->>'id' is not null then
        v_item_id := (v_item->>'id')::uuid;
        update items set
          ord = coalesce((v_item->>'ord')::smallint, 0),
          hanzi = v_item->>'hanzi',
          pinyin = v_item->>'pinyin',
          english = v_item->>'english',
          ocr_confidence = nullif(v_item->>'ocr_confidence', '')::real
        where id = v_item_id and section_id = v_section_id;
      else
        insert into items (section_id, ord, hanzi, pinyin, english, ocr_confidence)
        values (
          v_section_id,
          coalesce((v_item->>'ord')::smallint, 0),
          v_item->>'hanzi',
          v_item->>'pinyin',
          v_item->>'english',
          nullif(v_item->>'ocr_confidence', '')::real
        )
        returning id into v_item_id;

        insert into mastery (child_id, item_id, level) values (v_child_id, v_item_id, 0);
      end if;
    end loop;
  end loop;
end;
$$;

grant execute on function update_list_tx(uuid, text, date, jsonb) to authenticated;
