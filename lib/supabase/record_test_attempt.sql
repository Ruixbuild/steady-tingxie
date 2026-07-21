-- M4: atomic test-attempt recording, per handoff spec §7.3/§9.
-- M10: pass/fail for 'words' and 'passage' items is now decided here from
-- raw {strokes, totalMistakes} pairs the client reports, instead of trusting
-- a client-computed boolean — keeps the actual grading threshold server-side.
-- Requires touch_daily_streak.sql to already be applied.
-- Garden extension: grows a tree_growths row on an unsupervised test pass
-- for each kind (words/pinyin: v_passed; passage: zero missed chars) — the
-- garden only reflects tests actually passed, never Learn practice. Requires
-- garden_schema.sql to already be applied.
-- Run this once in the Supabase SQL Editor.
-- Drops the old 7-arg signature first — otherwise it coexists as an
-- ambiguous overload alongside the new 8-arg (hard_mode) one below.
drop function if exists record_test_attempt(uuid, uuid, text, boolean, int, int, jsonb);

create or replace function record_test_attempt(
  child_id uuid,
  list_id uuid,
  mode text,
  supervised boolean,
  guess_pct int,
  duration_s int,
  item_results jsonb,
  hard_mode boolean default false
) returns uuid -- new attempt id
language plpgsql
security invoker
as $$
declare
  v_attempt_id uuid;
  v_item jsonb;
  v_kind text;
  v_item_id uuid;
  v_hanzi text;
  v_passed boolean;
  v_total_chars int;
  v_missed jsonb;
  v_missed_count int;
  v_char_misses jsonb;
  v_pos text;
  v_prev_fail boolean;
  v_score int := 0;
  v_total int := 0;
  v_words_score int := 0; v_words_total int := 0;
  v_pinyin_score int := 0; v_pinyin_total int := 0;
  v_passage_score int := 0; v_passage_total int := 0;
  v_flipped jsonb := '[]'::jsonb;
  v_tricky_ids jsonb := '[]'::jsonb;
  v_pct int;
  v_best_before int;
  v_parent_id uuid;
  v_char jsonb;
  v_strokes int;
  v_total_mistakes int;
  v_base int;
  v_threshold int;
  v_char_passed boolean;
begin
  select best_pct into v_best_before from lists where id = record_test_attempt.list_id;

  for v_item in select * from jsonb_array_elements(record_test_attempt.item_results) loop
    v_kind := v_item->>'kind';
    v_item_id := (v_item->>'item_id')::uuid;

    if v_kind = 'passage' then
      v_total_chars := jsonb_array_length(coalesce(v_item->'chars', '[]'::jsonb));
      v_missed := '[]'::jsonb;
      v_missed_count := 0;

      for v_char in select * from jsonb_array_elements(coalesce(v_item->'chars', '[]'::jsonb)) loop
        v_strokes := coalesce((v_char->>'strokes')::int, 10);
        v_total_mistakes := coalesce((v_char->>'totalMistakes')::int, 999);
        v_base := greatest(2, ceil(v_strokes * 0.4));
        v_threshold := case when record_test_attempt.hard_mode then ceil(v_base * 0.25) else v_base end;
        v_char_passed := v_total_mistakes <= v_threshold;
        if not v_char_passed then
          v_missed := v_missed || to_jsonb((v_char->>'globalIndex')::int);
          v_missed_count := v_missed_count + 1;
        end if;
      end loop;

      v_score := v_score + (v_total_chars - v_missed_count);
      v_total := v_total + v_total_chars;
      v_passage_score := v_passage_score + (v_total_chars - v_missed_count);
      v_passage_total := v_passage_total + v_total_chars;

      if not record_test_attempt.supervised and v_missed_count > 0 then
        select m.char_misses into v_char_misses from mastery m
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;
        v_char_misses := coalesce(v_char_misses, '{}'::jsonb);

        for v_pos in select jsonb_array_elements_text(v_missed) loop
          v_char_misses := jsonb_set(
            v_char_misses, array[v_pos],
            to_jsonb(coalesce((v_char_misses->>v_pos)::int, 0) + 1)
          );
        end loop;

        update mastery m set char_misses = v_char_misses, last_seen = now()
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;
      end if;

      if not record_test_attempt.supervised and v_total_chars > 0 and v_missed_count = 0 then
        insert into tree_growths (child_id, item_id, term_key, tree_type)
        values (
          record_test_attempt.child_id, v_item_id, garden_term_key(now()),
          garden_tree_type(v_item_id::text, garden_term_key(now()))
        )
        on conflict (child_id, item_id, term_key) do nothing;
      end if;

    elsif v_kind = 'words' then
      v_passed := true;
      for v_char in select * from jsonb_array_elements(coalesce(v_item->'chars', '[]'::jsonb)) loop
        v_strokes := coalesce((v_char->>'strokes')::int, 10);
        v_total_mistakes := coalesce((v_char->>'totalMistakes')::int, 999);
        v_base := greatest(2, ceil(v_strokes * 0.4));
        v_threshold := case when record_test_attempt.hard_mode then ceil(v_base * 0.25) else v_base end;
        if v_total_mistakes > v_threshold then
          v_passed := false;
        end if;
      end loop;

      v_total := v_total + 1;
      if v_passed then v_score := v_score + 1; end if;
      v_words_total := v_words_total + 1;
      if v_passed then v_words_score := v_words_score + 1; end if;

      if not record_test_attempt.supervised then
        select m.prev_fail into v_prev_fail from mastery m
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;

        if v_passed then
          update mastery m set
            level = 3,
            improved = case when v_prev_fail then true else m.improved end,
            prev_fail = false,
            last_seen = now()
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;

          insert into tree_growths (child_id, item_id, term_key, tree_type)
          values (
            record_test_attempt.child_id, v_item_id, garden_term_key(now()),
            garden_tree_type(v_item_id::text, garden_term_key(now()))
          )
          on conflict (child_id, item_id, term_key) do nothing;

          if v_prev_fail then
            select hanzi into v_hanzi from items where id = v_item_id;
            v_flipped := v_flipped || jsonb_build_object('item_id', v_item_id, 'hanzi', v_hanzi);
          end if;
        else
          update mastery m set
            level = greatest(1, m.level - 1),
            misses = m.misses + 1,
            prev_fail = true,
            improved = false,
            last_seen = now()
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;

          v_tricky_ids := v_tricky_ids || to_jsonb(v_item_id::text);
        end if;
      elsif not v_passed then
        v_tricky_ids := v_tricky_ids || to_jsonb(v_item_id::text);
      end if;

    else -- 'pinyin'
      v_passed := coalesce((v_item->>'passed')::boolean, false);
      v_total := v_total + 1;
      if v_passed then v_score := v_score + 1; end if;
      v_pinyin_total := v_pinyin_total + 1;
      if v_passed then v_pinyin_score := v_pinyin_score + 1; end if;

      if not record_test_attempt.supervised then
        select m.prev_fail into v_prev_fail from mastery m
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;

        if v_passed then
          update mastery m set
            level = 3,
            improved = case when v_prev_fail then true else m.improved end,
            prev_fail = false,
            last_seen = now()
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;

          insert into tree_growths (child_id, item_id, term_key, tree_type)
          values (
            record_test_attempt.child_id, v_item_id, garden_term_key(now()),
            garden_tree_type(v_item_id::text, garden_term_key(now()))
          )
          on conflict (child_id, item_id, term_key) do nothing;

          if v_prev_fail then
            select hanzi into v_hanzi from items where id = v_item_id;
            v_flipped := v_flipped || jsonb_build_object('item_id', v_item_id, 'hanzi', v_hanzi);
          end if;
        else
          update mastery m set
            level = greatest(1, m.level - 1),
            misses = m.misses + 1,
            prev_fail = true,
            improved = false,
            last_seen = now()
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;

          v_tricky_ids := v_tricky_ids || to_jsonb(v_item_id::text);
        end if;
      elsif not v_passed then
        v_tricky_ids := v_tricky_ids || to_jsonb(v_item_id::text);
      end if;
    end if;
  end loop;

  v_pct := case when v_total > 0 then round(100.0 * v_score / v_total) else 0 end;

  insert into attempts (
    child_id, list_id, mode, supervised, score, total, guess_pct, duration_s, detail
  ) values (
    record_test_attempt.child_id, record_test_attempt.list_id, record_test_attempt.mode,
    record_test_attempt.supervised, v_score, v_total, record_test_attempt.guess_pct,
    record_test_attempt.duration_s,
    jsonb_build_object(
      'sections', jsonb_build_object(
        'words', jsonb_build_object('score', v_words_score, 'total', v_words_total),
        'pinyin', jsonb_build_object('score', v_pinyin_score, 'total', v_pinyin_total),
        'passage', jsonb_build_object('score', v_passage_score, 'total', v_passage_total)
      ),
      'flipped', v_flipped,
      'tricky_item_ids', v_tricky_ids,
      'best_pct_before', v_best_before
    )
  )
  returning id into v_attempt_id;

  if not record_test_attempt.supervised
     and v_total > 0
     and v_pct > coalesce(v_best_before, -1) then
    update lists set best_pct = v_pct where id = record_test_attempt.list_id;
  end if;

  v_parent_id := touch_daily_streak(record_test_attempt.child_id, null);
  insert into events (user_id, event) values (v_parent_id, 'test');

  return v_attempt_id;
end;
$$;

grant execute on function record_test_attempt(uuid, uuid, text, boolean, int, int, jsonb, boolean) to authenticated;
