-- M4: atomic test-attempt recording, per handoff spec §7.3/§9.
-- M10: pass/fail for 'words' and 'passage' items is now decided here from
-- raw {strokes, totalMistakes} pairs the client reports, instead of trusting
-- a client-computed boolean — keeps the actual grading threshold server-side.
-- Requires touch_daily_streak.sql to already be applied.
-- Garden extension: grows a tree_growths row on an unsupervised test pass
-- for each kind (words/pinyin: v_passed; passage: zero missed chars) — the
-- garden only reflects tests actually passed, never Learn practice. The
-- species (tree vs fruit) is a difficulty tier from garden_tier(), keyed
-- off the child's grade and the word's length/kind — see
-- garden_tier_migration.sql, which must be applied (after garden_schema.sql)
-- before this file.
-- Run this once in the Supabase SQL Editor.
-- Drops the old 7-arg signature first — otherwise it coexists as an
-- ambiguous overload alongside the new 8-arg (hard_mode) one below.
-- #variable_conflict use_column: every child_id reference in this function's
-- own body is already qualified, but the mastery/attempts/tree_growths/lists
-- RLS policies reference a bare, unqualified `child_id` in their USING/WITH
-- CHECK clauses. Since this parameter is also named child_id, that makes the
-- policy text ambiguous between the column and this function's parameter
-- (42702) the moment a write here gets row-security-checked — this pragma
-- resolves that in favor of the column, which is what RLS always means.
-- On a pass, misses is now reset to 0 alongside level — previously it was
-- left untouched, so isTricky() (level<2 OR misses>0) kept flagging an item
-- as tricky forever after even a single miss, no matter how many times it
-- was mastered afterward. Doesn't retroactively fix rows already stuck this
-- way — see this file's usage note for a one-time backfill.
-- 'words' items now ALSO record per-character char_misses, the same way
-- 'passage' always has — upper-primary ci yu can themselves be long
-- sentences, so "which character in this word" is as useful there as it is
-- for mo xie. Purely additive: the item-level pass/fail, level, and misses
-- logic for 'words' is unchanged, this only adds the per-position tracking
-- alongside it. Position is the character's 0-based index into the client's
-- `chars` array for that item, which — since TestSession quizzes a word's
-- characters strictly in order — is the same indexing passage already uses
-- (Array.from(hanzi) position), no separate globalIndex needed from the
-- client for 'words' the way passage sends one explicitly.
-- char_misses is now rebuilt fresh from EACH attempt (for both 'words' and
-- 'passage'), instead of merged/incremented onto history forever. A merge-
-- forever approach meant a word with one persistently-tricky character
-- (e.g. 竹) could go a long time without a fully clean pass, so any OTHER
-- character in it that had one bad attempt long ago and has been fine ever
-- since stayed flagged "weak" in Progress/Reports/Focus indefinitely,
-- since nothing short of the whole item passing cleanly ever touched
-- char_misses at all. A full rebuild each attempt is safe because every
-- character is requizzed every attempt — there's no partial retest.
-- Doesn't retroactively fix rows already stuck this way — run
-- `update mastery set char_misses = '{}'::jsonb where char_misses != '{}'::jsonb;`
-- once to clear all existing stale flags (safe for both passed and
-- still-tricky items — the next attempt on a still-tricky item repopulates
-- whatever's still actually wrong).
-- A 'words'/'passage' character can now be reported {skipped: true} from
-- TestCharQuiz's "Skip this one" button — this is a deliberate third,
-- neutral outcome alongside pass/fail, not a synonym for fail. A child
-- taps Skip either because they're confident they already know a word (an
-- efficiency skip) or because they genuinely can't write it — those two
-- cases are indistinguishable from a click alone, and the old behaviour
-- (always recording it as a hard failure, same as any other miss) meant a
-- word the child had genuinely mastered could get knocked back to "weak"
-- purely because they didn't feel like re-proving it. A skipped character
-- is excluded from this attempt's scoring entirely and its char_misses
-- entry, if any, is left exactly as it was — neither cleared (that would
-- be an unearned reward) nor flagged (that would be the original bug). If
-- every character in an item was skipped, the whole item is excluded from
-- this attempt's score and its mastery/level/misses are left untouched.
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
#variable_conflict use_column
declare
  v_attempt_id uuid;
  v_item jsonb;
  v_kind text;
  v_item_id uuid;
  v_hanzi text;
  v_passed boolean;
  v_attempted_count int;
  v_missed_count int;
  v_char_misses jsonb;
  v_skipped boolean;
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
  v_char_row record;
  v_strokes int;
  v_total_mistakes int;
  v_base int;
  v_threshold int;
  v_child_level text;
begin
  select best_pct into v_best_before from lists where id = record_test_attempt.list_id;
  select level into v_child_level from children where id = record_test_attempt.child_id;

  for v_item in select * from jsonb_array_elements(record_test_attempt.item_results) loop
    v_kind := v_item->>'kind';
    v_item_id := (v_item->>'item_id')::uuid;

    if v_kind = 'passage' then
      v_attempted_count := 0;
      v_missed_count := 0;

      if not record_test_attempt.supervised then
        select m.char_misses into v_char_misses from mastery m
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;
        v_char_misses := coalesce(v_char_misses, '{}'::jsonb);
      end if;

      for v_char in select * from jsonb_array_elements(coalesce(v_item->'chars', '[]'::jsonb)) loop
        -- A skip is neutral, not a third grade: the child asserted either
        -- "I already know this" (don't penalize) or "I don't know this"
        -- (don't reward) — either way nothing was actually demonstrated,
        -- so it's excluded from scoring entirely and its char_misses entry
        -- (if any) is left exactly as it was rather than cleared or
        -- flagged, instead of the old behaviour of always recording it as
        -- a hard failure regardless of which reason the child meant.
        v_skipped := coalesce((v_char->>'skipped')::boolean, false);
        if v_skipped then
          continue;
        end if;

        v_attempted_count := v_attempted_count + 1;
        v_strokes := coalesce((v_char->>'strokes')::int, 10);
        v_total_mistakes := coalesce((v_char->>'totalMistakes')::int, 999);
        v_base := greatest(2, ceil(v_strokes * 0.4));
        v_threshold := case when record_test_attempt.hard_mode then ceil(v_base * 0.25) else v_base end;
        if v_total_mistakes > v_threshold then
          v_missed_count := v_missed_count + 1;
          if not record_test_attempt.supervised then
            v_char_misses := jsonb_set(v_char_misses, array[(v_char->>'globalIndex')], to_jsonb(1));
          end if;
        elsif not record_test_attempt.supervised then
          v_char_misses := v_char_misses - (v_char->>'globalIndex');
        end if;
      end loop;

      v_score := v_score + (v_attempted_count - v_missed_count);
      v_total := v_total + v_attempted_count;
      v_passage_score := v_passage_score + (v_attempted_count - v_missed_count);
      v_passage_total := v_passage_total + v_attempted_count;

      if not record_test_attempt.supervised then
        update mastery m set char_misses = v_char_misses, last_seen = now()
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;
      end if;

      -- Same reasoning as the 'words' branch's level=3 gate below: a tree
      -- should only grow when the passage is genuinely fully clean, not
      -- just clean on whichever characters happened to be attempted this
      -- time — otherwise skipping over a character that's still flagged
      -- weak (char_misses non-empty) while passing the rest would grow a
      -- tree for a passage that isn't actually fully mastered.
      if not record_test_attempt.supervised and v_attempted_count > 0 and v_missed_count = 0
         and v_char_misses = '{}'::jsonb then
        select hanzi into v_hanzi from items where id = v_item_id;
        insert into tree_growths (child_id, item_id, term_key, tree_type)
        values (
          record_test_attempt.child_id, v_item_id, garden_term_key(now()),
          garden_tier(v_child_level, v_kind, v_hanzi)
        )
        on conflict (child_id, item_id, term_key) do nothing;
      end if;

    elsif v_kind = 'words' then
      v_attempted_count := 0;
      v_missed_count := 0;

      if not record_test_attempt.supervised then
        select m.char_misses into v_char_misses from mastery m
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;
        v_char_misses := coalesce(v_char_misses, '{}'::jsonb);
      end if;

      for v_char_row in
        select value as char_data, ordinality - 1 as pos
        from jsonb_array_elements(coalesce(v_item->'chars', '[]'::jsonb)) with ordinality as t(value, ordinality)
      loop
        -- See the identical skip-handling comment in the 'passage' branch
        -- above — same neutral treatment applies to a ci yu's characters.
        v_skipped := coalesce((v_char_row.char_data->>'skipped')::boolean, false);
        if v_skipped then
          continue;
        end if;

        v_attempted_count := v_attempted_count + 1;
        v_strokes := coalesce((v_char_row.char_data->>'strokes')::int, 10);
        v_total_mistakes := coalesce((v_char_row.char_data->>'totalMistakes')::int, 999);
        v_base := greatest(2, ceil(v_strokes * 0.4));
        v_threshold := case when record_test_attempt.hard_mode then ceil(v_base * 0.25) else v_base end;
        if v_total_mistakes > v_threshold then
          v_missed_count := v_missed_count + 1;
          if not record_test_attempt.supervised then
            v_char_misses := jsonb_set(v_char_misses, array[v_char_row.pos::text], to_jsonb(1));
          end if;
        elsif not record_test_attempt.supervised then
          v_char_misses := v_char_misses - v_char_row.pos::text;
        end if;
      end loop;

      -- Passed iff every ATTEMPTED character passed — a skipped character
      -- neither blocks nor forces a pass. If every character in the word
      -- was skipped, v_attempted_count is 0 and the word is excluded from
      -- scoring and mastery entirely below, rather than defaulting to
      -- either verdict.
      v_passed := v_attempted_count > 0 and v_missed_count = 0;

      if v_attempted_count > 0 then
        v_total := v_total + 1;
        if v_passed then v_score := v_score + 1; end if;
        v_words_total := v_words_total + 1;
        if v_passed then v_words_score := v_words_score + 1; end if;
      end if;

      if not record_test_attempt.supervised then
        update mastery m set char_misses = v_char_misses
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;
      end if;

      if v_attempted_count = 0 then
        -- Whole word skipped this attempt: level/misses/prev_fail are left
        -- untouched entirely — same neutrality as the per-character case.
        null;
      elsif not record_test_attempt.supervised then
        select m.prev_fail into v_prev_fail from mastery m
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;

        -- Full mastery (level 3) requires BOTH: every character attempted
        -- THIS time passed, AND char_misses is now fully clean — i.e. no
        -- OTHER character in the word is still sitting on an old flag from
        -- being skipped over. Without the second condition, skipping the
        -- two characters that are actually weak (圆,圆) while correctly
        -- writing the rest (的山竹) would mark the whole word "mastered"
        -- even though char_misses still (rightly) flags 圆,圆 as weak —
        -- Focus/the progress emoji would then contradict the per-character
        -- view. A clean attempt that still leaves other flags outstanding
        -- is treated as neutral instead (below): nothing was gotten wrong
        -- this time, so it doesn't regress, but it also can't claim full
        -- mastery while known weak spots remain unaddressed.
        if v_passed and v_char_misses = '{}'::jsonb then
          update mastery m set
            level = 3,
            misses = 0,
            improved = case when v_prev_fail then true else m.improved end,
            prev_fail = false,
            last_seen = now()
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;

          select hanzi into v_hanzi from items where id = v_item_id;
          insert into tree_growths (child_id, item_id, term_key, tree_type)
          values (
            record_test_attempt.child_id, v_item_id, garden_term_key(now()),
            garden_tier(v_child_level, v_kind, v_hanzi)
          )
          on conflict (child_id, item_id, term_key) do nothing;

          if v_prev_fail then
            v_flipped := v_flipped || jsonb_build_object('item_id', v_item_id, 'hanzi', v_hanzi);
          end if;
        elsif v_passed then
          -- Neutral: nothing attempted was wrong, but other characters are
          -- still outstanding — leave level/misses/prev_fail untouched.
          null;
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
            misses = 0,
            improved = case when v_prev_fail then true else m.improved end,
            prev_fail = false,
            last_seen = now()
          where m.child_id = record_test_attempt.child_id and m.item_id = v_item_id;

          select hanzi into v_hanzi from items where id = v_item_id;
          insert into tree_growths (child_id, item_id, term_key, tree_type)
          values (
            record_test_attempt.child_id, v_item_id, garden_term_key(now()),
            garden_tier(v_child_level, v_kind, v_hanzi)
          )
          on conflict (child_id, item_id, term_key) do nothing;

          if v_prev_fail then
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
