-- revision_schema.sql
-- APPLY MANUALLY in Supabase SQL Editor. Not auto-applied. (Repo convention.)
-- Vocabulary Revision — a sibling feature to TingXie, not part of it. Fixed
-- per-grade vocabulary content (识读/识写 split), distinct from TingXie's
-- parent-uploaded dictation lists. See CLAUDE.md's Revision guardrails
-- before touching any TingXie file while working on this feature.
--
-- An earlier, abandoned attempt at this feature left live-database traces —
-- revision_attempts/revision_mastery/revision_assignments tables referenced
-- in delete_child_tx.sql, of unknown current shape. This schema treats that
-- prior attempt as gone and defines revision_vocab/revision_mastery fresh.
-- Drop the old tables first if they still exist:
--   drop table if exists revision_assignments;
--   drop table if exists revision_attempts;
--   drop table if exists revision_mastery;
--
-- Run this file's CREATE TABLE section AND the RLS section below in the same
-- SQL Editor session, back-to-back — a table created without RLS enabled is
-- readable/writable by any authenticated role under this project's default
-- grants until "enable row level security" runs.

-- ============================================================
-- Tables
-- ============================================================

-- Global reference content — no child_id. Seeded once per grade/edition via
-- revision_seed_p4.sql (and future revision_seed_*.sql files the same way),
-- never written to by the app itself.
create table revision_vocab(
  id uuid primary key default gen_random_uuid(),
  primary_level text not null,               -- 'P4' etc — matches children.level's format
  edition text not null default 'huanlehuoban-2025',
  chapter_number int not null,
  chapter_title text not null,
  sort int not null,
  hanzi text not null,
  pinyin text not null,
  english text not null,
  skill text not null check(skill in('read','write','both')),
  is_higher_chinese boolean not null default false,
  cn_definition text not null default '',
  sentence_1 text not null default '',
  sentence_2 text not null default '',
  pairing_1 text,
  pairing_2 text,
  pairing_3 text,
  pairing_4 text,
  created_at timestamptz not null default now(),
  unique(primary_level, edition, chapter_number, sort)
);
create index on revision_vocab(primary_level, edition, chapter_number, sort);

-- Per (child, vocab, skill) mastery track. A word with skill='both' gets two
-- independent rows (one 'read', one 'write') — a child can be ahead on one
-- track and behind on the other, and both the chapter hub and the (future)
-- zoo depend on that being tracked separately rather than one blended
-- number per word.
-- level: 0 untouched, 1 struggling, 2 learning, 3 mastered (passed the
-- harder Level-2 test — see lib/revision/mastery.ts's chapterStage()).
-- flagged: the Learn screen's attention flag. Column exists from day one;
-- no UI sets it until the Learn phase ships.
create table revision_mastery(
  child_id uuid not null references children(id) on delete cascade,
  vocab_id uuid not null references revision_vocab(id) on delete cascade,
  skill text not null check(skill in('read','write')),
  level int not null default 0,
  misses int not null default 0,
  prev_fail boolean not null default false,
  improved boolean not null default false,
  flagged boolean not null default false,
  last_seen timestamptz,
  primary key(child_id, vocab_id, skill)
);
create index on revision_mastery(child_id);

-- Gates is_higher_chinese vocab rows — a Higher Chinese child sees a
-- chapter's full word list, everyone else sees the non-HC subset.
alter table children add column higher_chinese boolean not null default false;

-- ============================================================
-- RLS
-- ============================================================

-- Global content: readable by anyone signed in, no insert/update/delete
-- policy at all — only the SQL Editor (running as table owner) or a future
-- service-role seed script can ever write to it.
alter table revision_vocab enable row level security;

create policy "p_revision_vocab_select" on revision_vocab
  for select to authenticated
  using(true);

-- Predicate copied verbatim from the live mastery/tree_growths policies.
alter table revision_mastery enable row level security;

create policy "p_revision_mastery" on revision_mastery
  for all to authenticated
  using(child_id in(select id from children where parent_id=auth.uid()))
  with check(child_id in(select id from children where parent_id=auth.uid()));
