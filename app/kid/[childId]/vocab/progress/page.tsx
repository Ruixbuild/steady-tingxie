import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ChapterSummary, RevisionChildRow, RevisionMastery, RevisionVocab } from "@/lib/revision/types";
import AllChaptersZooClient from "./AllChaptersZooClient";

const EDITION = "huanlehuoban-2025";

// Cross-chapter zoo view — coexists with the sibling dynamic route
// vocab/[chapterNumber]/progress (Next.js resolves this literal "progress"
// segment ahead of the dynamic one, same as any static-vs-dynamic sibling
// route pair).
export default async function VocabAllChaptersProgressPage({
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
    .select("id, name, level, higher_chinese")
    .eq("id", childId)
    .maybeSingle();
  const child = childResult.data as unknown as Pick<
    RevisionChildRow,
    "id" | "name" | "level" | "higher_chinese"
  > | null;
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
  if (allWords.length === 0) notFound();

  const chapterMap = new Map<number, ChapterSummary>();
  for (const w of allWords) {
    const existing = chapterMap.get(w.chapter_number);
    if (existing) existing.words.push(w);
    else chapterMap.set(w.chapter_number, { chapterNumber: w.chapter_number, chapterTitle: w.chapter_title, words: [w] });
  }
  const chapters = Array.from(chapterMap.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);

  const { data: masteryRaw } = await supabase
    .from("revision_mastery")
    .select("child_id, vocab_id, skill, level, misses, prev_fail, improved, flagged, last_seen")
    .eq("child_id", childId)
    .in(
      "vocab_id",
      allWords.map((w) => w.id)
    );
  const masteryRows = (masteryRaw ?? []) as unknown as RevisionMastery[];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-4">
        <Link
          href={`/kid/${childId}/vocab`}
          className="inline-block text-base"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Back
        </Link>
        <div>
          <h1 className="text-2xl font-semibold mb-1">{child.name}&apos;s vocab zoo</h1>
          <p style={{ color: "var(--mut)" }}>Every chapter, all in one place</p>
        </div>

        <AllChaptersZooClient childId={childId} chapters={chapters} masteryRows={masteryRows} />
      </div>
    </main>
  );
}
