import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RevisionChildRow, RevisionMastery, RevisionVocab } from "@/lib/revision/types";
import { masteryMapFromRows, skillLevel } from "@/lib/revision/mastery";
import { FRESHNESS_STALE_DAYS, sampleFreshPairs, staleMasteredPairs } from "@/lib/revision/freshness";
import { buildLegsFromPairs } from "@/lib/revision/testScoring";
import CrossChapterTestHost from "../practice/CrossChapterTestHost";

const EDITION = "huanlehuoban-2025";
const SAMPLE_SIZE = 10;

// "Keep it fresh": randomly samples SAMPLE_SIZE already-mastered (word,
// skill) pairs that haven't been touched in FRESHNESS_STALE_DAYS, across
// every chapter (not scoped to "learnt" chapters like vocab/practice's
// tricky-words session -- a mastered word's chapter is definitionally
// already learnt). Logged to revision_freshness_log at sample time, before
// the session even starts, so a repeated or abandoned "Keep it fresh" tap
// still rotates through the stale pool instead of re-offering the same
// words -- see that table's own header comment and lib/revision/
// freshness.ts's sampleFreshPairs for why.
export default async function KeepItFreshPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const childResult = await supabase
    .from("children")
    .select("id, level, higher_chinese")
    .eq("id", childId)
    .maybeSingle();
  const child = childResult.data as unknown as Pick<RevisionChildRow, "id" | "level" | "higher_chinese"> | null;
  if (!child) notFound();

  const cookieStore = await cookies();
  const levelCookie = cookieStore.get(`lastPrimaryLevel_${childId}`)?.value;
  const effectiveLevel = levelCookie || child.level;

  const { data: vocabRaw } = await supabase
    .from("revision_vocab")
    .select(
      "id, primary_level, edition, chapter_number, chapter_title, sort, hanzi, pinyin, english, skill, is_higher_chinese, cn_definition, sentence_1, sentence_2, pairing_1, pairing_2, pairing_3, pairing_4"
    )
    .eq("primary_level", effectiveLevel)
    .eq("edition", EDITION);
  const allWords = ((vocabRaw ?? []) as unknown as RevisionVocab[]).filter(
    (w) => child.higher_chinese || !w.is_higher_chinese
  );

  const { data: masteryRaw } =
    allWords.length > 0
      ? await supabase
          .from("revision_mastery")
          .select("child_id, vocab_id, skill, level, misses, prev_fail, improved, flagged, last_seen")
          .eq("child_id", childId)
          .in(
            "vocab_id",
            allWords.map((w) => w.id)
          )
      : { data: [] };
  const masteryByKey = masteryMapFromRows((masteryRaw ?? []) as unknown as RevisionMastery[]);

  const staleSinceIso = new Date(new Date().getTime() - FRESHNESS_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLogRaw } =
    allWords.length > 0
      ? await supabase
          .from("revision_freshness_log")
          .select("vocab_id, skill")
          .eq("child_id", childId)
          .gte("sampled_at", staleSinceIso)
      : { data: [] };
  const excludeKeys = new Set(
    ((recentLogRaw ?? []) as unknown as { vocab_id: string; skill: "read" | "write" }[]).map(
      (r) => `${r.vocab_id}:${r.skill}`
    )
  );

  const pool = staleMasteredPairs(allWords, masteryByKey);
  const sampled = sampleFreshPairs(pool, excludeKeys, SAMPLE_SIZE);

  const backHref = `/kid/${childId}/vocab`;

  if (sampled.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl flex flex-col items-center gap-4 text-center">
          <Link href={backHref} className="self-start text-base" style={{ color: "var(--accent)", fontWeight: 700 }}>
            ← Back
          </Link>
          <p className="text-2xl mt-8">🌱</p>
          <p className="font-semibold">Nothing to freshen up yet</p>
          <p style={{ color: "var(--mut)" }}>
            Come back once you&apos;ve mastered some words and let them sit for a couple of weeks.
          </p>
        </div>
      </main>
    );
  }

  // Logged before the session renders (not on completion) so an abandoned
  // or repeated tap still counts as "offered" — see revision_freshness_log
  // .sql. Fire-and-forget would risk the insert losing a race with the
  // page finishing render; awaited here since it's cheap and this route is
  // only hit on a deliberate "Keep it fresh" tap, not a hot path.
  // revision_freshness_log isn't in the shared Database generic (see
  // lib/revision/types.ts's header note) — supabase-js types an insert
  // payload against an undeclared table as `never`, unlike select, which
  // stays permissive. Cast the table handle itself for the write, same
  // pattern as masteryActions.ts's touchMastery.
  await (
    supabase.from("revision_freshness_log") as unknown as { insert: (rows: object[]) => Promise<unknown> }
  ).insert(sampled.map((p) => ({ child_id: childId, vocab_id: p.word.id, skill: p.skill })));

  const legs = buildLegsFromPairs(sampled);
  const learntWords = allWords.filter((w) => skillLevel(w.id, "read", masteryByKey) >= 1);

  return (
    <CrossChapterTestHost
      childId={childId}
      legs={legs}
      chapterWords={allWords}
      learntWords={learntWords}
      backHref={backHref}
      legLabel="keep it fresh"
      completeTitle="🎉 Freshness check complete!"
    />
  );
}
