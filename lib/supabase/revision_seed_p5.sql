-- revision_seed_p5.sql
-- APPLY MANUALLY in Supabase SQL Editor, after revision_schema.sql.
-- Seeds P5 huanlehuoban-2025 chapter 1, transcribed from Vocab
-- List/P5_Vocab.csv. As of this transcription the CSV only contains 2
-- words (both in chapter 1, "到户外去") -- this replaces the earlier
-- placeholder content, which was a duplicate of P4's chapters. Re-run this
-- file (and re-apply) when more chapters/words are added to the CSV.
--
-- Re-running this file is safe: on conflict (primary_level, edition,
-- chapter_number, sort) it upserts (not just skips) so a later re-run
-- with corrected CSV data actually fixes previously-seeded rows too.
-- NOTE: this replaces chapter 2 ("我们是兄弟姐妹") content entirely -- if
-- the previous seed's chapter-2 rows are still present in the DB, delete
-- them manually since this file no longer re-upserts over them:
--   delete from revision_vocab where primary_level = 'P5' and edition = 'huanlehuoban-2025' and chapter_number = 2;

insert into revision_vocab
  (primary_level, edition, chapter_number, chapter_title, sort, hanzi, pinyin, english, skill, is_higher_chinese, cn_definition, sentence_1, sentence_2, pairing_1, pairing_2, pairing_3, pairing_4)
values
  ('P5','huanlehuoban-2025',1,'到户外去',1,'露营','lù yíng','camping','write',false,'露营是在户外搭帐篷或住在营地，和家人朋友一起过夜。','我第一次露营，觉得很开心。','这个周末，我们要去海边露营。','露营活动','户外露营',null,null),
  ('P5','huanlehuoban-2025',1,'到户外去',2,'探险','Tàn xiǎn','explore','both',true,'探险是到不熟悉的地方去探索，看看新的事物。','孩子们在公园里玩探险游戏。','我们读了一本关于探险的故事书。','探险故事','探险活动',null,null)
on conflict (primary_level, edition, chapter_number, sort) do update set
  chapter_title = excluded.chapter_title,
  hanzi = excluded.hanzi,
  pinyin = excluded.pinyin,
  english = excluded.english,
  skill = excluded.skill,
  is_higher_chinese = excluded.is_higher_chinese,
  cn_definition = excluded.cn_definition,
  sentence_1 = excluded.sentence_1,
  sentence_2 = excluded.sentence_2,
  pairing_1 = excluded.pairing_1,
  pairing_2 = excluded.pairing_2,
  pairing_3 = excluded.pairing_3,
  pairing_4 = excluded.pairing_4;
