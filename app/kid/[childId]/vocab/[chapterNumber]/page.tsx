import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RevisionChildRow, RevisionMastery, RevisionVocab } from "@/lib/revision/types";
import {
  isFlagged,
  masteryMapFromRows,
  skillProgress,
  skillStage,
  STAGE_EMOJI,
  tracksFor,
} from "@/lib/revision/mastery";
import RevisionRefresher from "@/app/kid/[childId]/vocab/RevisionRefresher";

const EDITION = "huanlehuoban-2025";

export default async function VocabChapterHubPage({
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

  // Which primary level's vocab to show -- the child's own registered
  // level by default, or whatever the level picker on the vocab index page
  // last set (same cookie it writes), so a chosen "revise a different
  // grade" preference carries through every route under this chapter.
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
  const masteryByKey = masteryMapFromRows((masteryRaw ?? []) as unknown as RevisionMastery[]);

  const readWords = words.filter((w) => tracksFor(w.skill).includes("read"));
  const writeWords = words.filter((w) => tracksFor(w.skill).includes("write"));
  const readProgress = skillProgress(words, "read", masteryByKey);
  const writeProgress = skillProgress(words, "write", masteryByKey);

  const base = `/kid/${childId}/vocab/${chapterNumber}`;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <RevisionRefresher />
      <div className="w-full max-w-xl">
        <Link
          href={`/kid/${childId}/vocab`}
          className="mb-4 inline-block text-base"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Back
        </Link>
        <h1 className="hanzi text-2xl font-semibold mb-1">{chapterTitle}</h1>
        <p className="mb-6" style={{ color: "var(--mut)" }}>
          Chapter {String(chapterNumber).padStart(2, "0")}
        </p>

        <div className="flex flex-col gap-4 mb-4">
          <Link
            href={`${base}/learn`}
            className="rounded-[18px] p-5 flex flex-col gap-1"
            style={{ background: "var(--accent-soft)", color: "var(--accent-d)" }}
          >
            <span className="text-3xl">📖</span>
            <span className="font-semibold text-lg">Learn</span>
            <span className="text-sm opacity-80">meanings. pairings. strokes</span>
          </Link>

          <Link
            href={`${base}/test`}
            className="rounded-[18px] p-5 flex flex-col gap-1"
            style={{ background: "var(--warn-soft)", color: "#8A6412" }}
          >
            <span className="text-3xl">✏️</span>
            <span className="font-semibold text-lg">Test</span>
            <span className="text-sm opacity-80">listen. recognize. write</span>
          </Link>

          <Link
            href={`${base}/progress`}
            className="rounded-[18px] p-5 flex flex-col gap-1"
            style={{ background: "var(--ok-soft)", color: "#3E7A4E" }}
          >
            <span className="text-3xl">🐓</span>
            <span className="font-semibold text-lg">Progress</span>
            <span className="text-sm opacity-80">my vocabulary farm</span>
          </Link>
        </div>

        <div className="card p-5 mb-6">
          <p className="font-semibold mb-1">Mastery</p>
          <p style={{ color: "var(--mut)" }}>
            识读 {readProgress.mastered}/{readProgress.total} · 识写 {writeProgress.mastered}/{writeProgress.total}
          </p>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <p className="text-sm mb-2" style={{ color: "var(--mut)" }}>
            👁 识读
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {readWords.map((w) => (
              <div
                key={`read-${w.id}`}
                className="hanzi flex items-center gap-1 rounded-2xl px-3 py-2 text-lg"
                style={{ background: "#fff", border: "1.5px solid var(--line)" }}
              >
                {isFlagged(w.id, masteryByKey) && <span className="text-sm">🚩</span>}
                {w.hanzi}
                <span className="text-sm">{STAGE_EMOJI[skillStage(w, "read", masteryByKey)]}</span>
              </div>
            ))}
          </div>

          <p className="text-sm mb-2" style={{ color: "var(--mut)" }}>
            ✍️ 识写
          </p>
          <div className="flex flex-wrap gap-2">
            {writeWords.map((w) => (
              <div
                key={`write-${w.id}`}
                className="hanzi flex items-center gap-1 rounded-2xl px-3 py-2 text-lg"
                style={{ background: "#fff", border: "1.5px solid var(--line)" }}
              >
                {isFlagged(w.id, masteryByKey) && <span className="text-sm">🚩</span>}
                {w.hanzi}
                <span className="text-sm">{STAGE_EMOJI[skillStage(w, "write", masteryByKey)]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
