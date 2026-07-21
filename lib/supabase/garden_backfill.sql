-- garden_backfill.sql
-- ONE-TIME, run manually in the Supabase SQL Editor, after garden_schema.sql
-- AND garden_tier_migration.sql (this calls garden_tier()). Safe to re-run
-- (ON CONFLICT DO NOTHING) if you need to catch rows written between runs.
--
-- Backfills tree_growths for test passes that happened before the garden
-- feature existed. mastery.level=3 is only ever set by record_test_attempt
-- on an unsupervised words/pinyin pass (see that file) — it's the one
-- signal left of "this was tested and passed" for pre-existing data, so
-- that's what this keys off. mastery.last_seen (the timestamp of that
-- pass, or the closest thing to it we kept) decides which term the
-- backfilled tree lands in. tree_type is the same difficulty-tier
-- (garden_tier: grade + word length/kind) real growths use.
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
  garden_tier(c.level, s.kind, i.hanzi)
from mastery m
join children c on c.id = m.child_id
join items i on i.id = m.item_id
join sections s on s.id = i.section_id
where m.level = 3
on conflict (child_id, item_id, term_key) do nothing;

-- ============================================================
-- Verification (optional) — run after the insert above to confirm
-- coverage across every child, not just the one you're testing with.
-- "mastered" should equal "trees" for every row; a gap means either the
-- backfill hasn't been run yet or those masteries are passage kind
-- (excluded, see note above).
-- ============================================================
-- select
--   c.id as child_id,
--   c.name,
--   count(*) filter (where m.level = 3) as mastered,
--   count(distinct tg.item_id) as trees
-- from children c
-- left join mastery m on m.child_id = c.id
-- left join tree_growths tg on tg.child_id = c.id
-- group by c.id, c.name
-- order by c.name;
