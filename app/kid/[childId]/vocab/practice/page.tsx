import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RevisionChildRow, RevisionMastery, RevisionVocab } from "@/lib/revision/types";
import { isChapterLearnt, masteryMapFromRows, skillLevel } from "@/lib/revision/mastery";
import { buildTrickyLegs } from "@/lib/revision/testScoring";
import CrossChapterTestHost from "./CrossChapterTestHost";

const EDITION = "huanlehuoban-2025";

// Cross-chapter tricky-word practice: pulls tricky words from every chapter
// the child has actually started (see isChapterLearnt) into one multi-leg
// session, instead of the vocab hub's old "continue to active chapter"
// banner, which duplicated the chapter list right below it. See
// lib/revision/testScoring.ts's buildTrickyLegs for why a chapter that
// hasn't been touched at all is excluded rather than contributing every one
// of its untouched words as false-positive "tricky".
export default async function CrossChapterPracticePage({
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
    .eq("edition", EDITION)
    .order("chapter_number")
    .order("sort");
  const allWords = ((vocabRaw ?? []) as unknown as RevisionVocab[]).filter(
    (w) => child.higher_chinese || !w.is_higher_chinese
  );

  const chapterMap = new Map<number, RevisionVocab[]>();
  for (const w of allWords) {
    const existing = chapterMap.get(w.chapter_number);
    if (existing) existing.push(w);
    else chapterMap.set(w.chapter_number, [w]);
  }

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

  const learntChapterWords = Array.from(chapterMap.values())
    .filter((words) => isChapterLearnt(words, masteryByKey))
    .flat();

  const legs = buildTrickyLegs(learntChapterWords, masteryByKey);

  // Same broader distractor pool defaultTestLevelForWords/pickReadDistractors
  // already use per chapter (see the per-chapter test/page.tsx) — every word
  // at this level the child has any read-exposure to, across all chapters.
  const learntWords = allWords.filter((w) => skillLevel(w.id, "read", masteryByKey) >= 1);

  const backHref = `/kid/${childId}/vocab`;

  if (legs.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl flex flex-col items-center gap-4 text-center">
          <Link href={backHref} className="self-start text-base" style={{ color: "var(--accent)", fontWeight: 700 }}>
            ← Back
          </Link>
          <p className="text-2xl mt-8">🎉</p>
          <p className="font-semibold">No tricky words right now!</p>
          <p style={{ color: "var(--mut)" }}>
            Nothing needs practice across the chapters you&apos;ve started. Nice work.
          </p>
        </div>
      </main>
    );
  }

  return (
    <CrossChapterTestHost
      childId={childId}
      legs={legs}
      chapterWords={allWords}
      learntWords={learntWords}
      backHref={backHref}
    />
  );
}
