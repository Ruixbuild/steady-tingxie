-- garden_backfill.sql
-- ONE-TIME, run manually in the Supabase SQL Editor, once, after
-- garden_schema.sql has been applied. Safe to re-run (ON CONFLICT DO
-- NOTHING) if you need to catch rows written between runs.
--
-- Backfills tree_growths for test passes that happened before the garden
-- feature existed. mastery.level=3 is only ever set by record_test_attempt
-- on an unsupervised words/pinyin pass (see that file) — it's the one
-- signal left of "this was tested and passed" for pre-existing data, so
-- that's what this keys off. mastery.last_seen (the timestamp of that
-- pass, or the closest thing to it we kept) decides which term the
-- backfilled tree lands in.
--
-- Passage/默写 items are NOT backfilled: record_test_attempt never wrote
-- mastery.level for passage kind (only char_misses), so there's no stored
-- signal distinguishing "tested and passed with zero misses" from "never
-- tested" for historical passage attempts. Passage trees will start
-- growing going forward from the next passed 默写 test.
insert into tree_growths (child_id, item_id, term_key, tree_type)
select
  m.child_id,
  m.item_id,
  garden_term_key(coalesce(m.last_seen, now())),
  garden_tree_type(m.item_id::text, garden_term_key(coalesce(m.last_seen, now())))
from mastery m
where m.level = 3
on conflict (child_id, item_id, term_key) do nothing;
