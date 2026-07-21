-- garden_schema.sql
-- APPLY MANUALLY in Supabase SQL Editor. Not auto-applied. (Repo convention.)
-- Seasonal Garden extension — see tingxie-garden-extension.md §2.
--
-- Run this file's CREATE TABLE/FUNCTION section AND the RLS section below in
-- the same SQL Editor session, back-to-back. A table created without RLS
-- enabled is readable/writable by any authenticated role under this
-- project's default grants until "enable row level security" runs — do not
-- leave that gap open.
--
-- garden_term_key / garden_tree_type must exist before record_item_progress.sql
-- and record_test_attempt.sql are (re-)applied, since those call them.

-- ============================================================
-- Table
-- ============================================================

create table tree_growths(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  term_key text not null,
  tree_type text not null check(tree_type in('pine','blossom','fruit')),
  grown_at timestamptz not null default now(),
  unique(child_id, item_id, term_key)
);
create index on tree_growths(child_id, term_key);

-- ============================================================
-- Helper functions (term boundaries + deterministic tree type)
-- ============================================================

-- Term boundaries: Jan1-Mar15 (T1), Mar16-Jun14 (T2), Jun15-Sep10 (T3),
-- Sep11-Dec31 (T4). No gaps/overlaps. Computed in Asia/Singapore local date,
-- matching the tz convention used by touch_daily_streak/record_set_complete.
create or replace function garden_term_key(p_at timestamptz default now())
returns text
language plpgsql
stable
as $$
declare
  v_local date := (p_at at time zone 'Asia/Singapore')::date;
  v_md int := extract(month from v_local)::int * 100 + extract(day from v_local)::int;
  v_term int;
begin
  if v_md >= 101 and v_md <= 315 then v_term := 1;
  elsif v_md >= 316 and v_md <= 614 then v_term := 2;
  elsif v_md >= 615 and v_md <= 910 then v_term := 3;
  else v_term := 4;
  end if;
  return extract(year from v_local)::text || '-T' || v_term;
end;
$$;

-- Deterministic per (item, term) tree species — mirrors lib/garden.ts's
-- treeType()/hashString() bit-for-bit (32-bit unsigned multiply-add per
-- char, mod applied every step, not just at the end) so the two never
-- disagree. Only ASCII input (uuid + "YYYY-Tn") is ever passed in, so
-- ascii() lines up with JS charCodeAt().
create or replace function garden_tree_type(p_item_id text, p_term_key text)
returns text
language plpgsql
immutable
as $$
declare
  v_str text := p_item_id || p_term_key;
  v_hash bigint := 0;
  v_types text[] := array['pine','blossom','fruit'];
  i int;
begin
  for i in 1..length(v_str) loop
    v_hash := (v_hash * 31 + ascii(substr(v_str, i, 1))) % 4294967296;
  end loop;
  return v_types[(v_hash % 3) + 1];
end;
$$;

-- ============================================================
-- RLS
-- ============================================================

-- Predicate copied verbatim from the live mastery/attempts policies, same
-- as revision_schema.sql's p_rev_* policies.
alter table tree_growths enable row level security;

create policy "p_tree" on tree_growths
  for all to authenticated
  using(child_id in(select id from children where parent_id=auth.uid()))
  with check(child_id in(select id from children where parent_id=auth.uid()));
