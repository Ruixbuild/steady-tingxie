import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RevisionAttempt, RevisionChildRow, RevisionMastery, RevisionVocab } from "@/lib/revision/types";
import ZooClient from "./ZooClient";

const EDITION = "huanlehuoban-2025";

export default async function VocabProgressPage({
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
  const chapterTitle = words[0].chapter_title;

  const { data: masteryRaw } = await supabase
    .from("revision_mastery")
    .select("child_id, vocab_id, skill, level, misses, prev_fail, improved, flagged, last_seen")
    .eq("child_id", childId)
    .in(
      "vocab_id",
      words.map((w) => w.id)
    );
  const masteryRows = (masteryRaw ?? []) as unknown as RevisionMastery[];

  const { data: attemptsRaw } = await supabase
    .from("revision_attempts")
    .select("id, child_id, chapter_number, skill, test_level, score, total, detail, taken_at")
    .eq("child_id", childId)
    .eq("chapter_number", chapterNumber)
    .order("taken_at", { ascending: false })
    .limit(10);
  const recentAttempts = (attemptsRaw ?? []) as unknown as RevisionAttempt[];

  const base = `/kid/${childId}/vocab/${chapterNumber}`;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-4">
        <Link href={base} className="inline-block text-base" style={{ color: "var(--accent)", fontWeight: 700 }}>
          ← Back
        </Link>
        <div>
          <h1 className="hanzi text-2xl font-semibold mb-1">{chapterTitle}</h1>
          <p style={{ color: "var(--mut)" }}>My vocab zoo</p>
        </div>

        <ZooClient
          base={base}
          allChaptersHref={`/kid/${childId}/vocab/progress`}
          words={words}
          masteryRows={masteryRows}
          recentAttempts={recentAttempts}
        />
      </div>
    </main>
  );
}
