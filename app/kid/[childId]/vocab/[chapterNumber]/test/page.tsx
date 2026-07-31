import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RevisionChildRow, RevisionMastery, RevisionVocab } from "@/lib/revision/types";
import { masteryMapFromRows, skillLevel } from "@/lib/revision/mastery";
import TestHost from "./TestHost";

const EDITION = "huanlehuoban-2025";

export default async function VocabTestPage({
  params,
}: {
  params: Promise<{ childId: string; chapterNumber: string }>;
}) {
  const { childId, chapterNumber: chapterNumberParam } = await params;
  const chapterNumber = Number(chapterNumberParam);

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
    .eq("chapter_number", chapterNumber)
    .order("sort");
  const words = ((vocabRaw ?? []) as unknown as RevisionVocab[]).filter(
    (w) => child.higher_chinese || !w.is_higher_chinese
  );
  if (words.length === 0) notFound();

  const { data: masteryRaw } = await supabase
    .from("revision_mastery")
    .select("child_id, vocab_id, skill, level, misses, prev_fail, improved, flagged, last_seen")
    .eq("child_id", childId)
    .in(
      "vocab_id",
      words.map((w) => w.id)
    );
  const masteryRows = (masteryRaw ?? []) as unknown as RevisionMastery[];

  // Broader pool for 识读 distractor selection (pickReadDistractors): every
  // word at this primary level/edition, across all chapters, plus this
  // child's own read-mastery for that whole pool -- so a chapter that's too
  // short or too narrow (e.g. all 2-character words) to supply enough
  // same-length distractors on its own can still fall back to other words
  // the child has actually been exposed to, instead of an unrelated-length
  // word or too few options.
  const { data: allVocabRaw } = await supabase
    .from("revision_vocab")
    .select(
      "id, primary_level, edition, chapter_number, chapter_title, sort, hanzi, pinyin, english, skill, is_higher_chinese, cn_definition, sentence_1, sentence_2, pairing_1, pairing_2, pairing_3, pairing_4"
    )
    .eq("primary_level", effectiveLevel)
    .eq("edition", EDITION);
  const allWords = ((allVocabRaw ?? []) as unknown as RevisionVocab[]).filter(
    (w) => child.higher_chinese || !w.is_higher_chinese
  );

  const { data: allMasteryRaw } = await supabase
    .from("revision_mastery")
    .select("child_id, vocab_id, skill, level, misses, prev_fail, improved, flagged, last_seen")
    .eq("child_id", childId)
    .eq("skill", "read")
    .in(
      "vocab_id",
      allWords.map((w) => w.id)
    );
  const allMasteryByKey = masteryMapFromRows((allMasteryRaw ?? []) as unknown as RevisionMastery[]);
  const learntWords = allWords.filter((w) => skillLevel(w.id, "read", allMasteryByKey) >= 1);

  const base = `/kid/${childId}/vocab/${chapterNumber}`;

  return (
    <TestHost
      childId={childId}
      chapterNumber={chapterNumber}
      base={base}
      words={words}
      masteryRows={masteryRows}
      learntWords={learntWords}
    />
  );
}
