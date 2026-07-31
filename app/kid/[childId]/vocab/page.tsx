import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RevisionChildRow, RevisionMastery, RevisionVocab } from "@/lib/revision/types";
import { chapterStage, masteryMapFromRows, STAGE_EMOJI, weeklyReviewedCount } from "@/lib/revision/mastery";
import ChapterSelector from "./ChapterSelector";
import PrimaryLevelSelector from "./PrimaryLevelSelector";
import RevisionRefresher from "./RevisionRefresher";

const EDITION = "huanlehuoban-2025";

export default async function VocabRevisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ chapter?: string; level?: string }>;
}) {
  const { childId } = await params;
  const { chapter: requestedChapter, level: requestedLevel } = await searchParams;
  const cookieStore = await cookies();
  const lastChapterCookie = cookieStore.get(`lastChapter_${childId}`)?.value;
  const lastPrimaryLevelCookie = cookieStore.get(`lastPrimaryLevel_${childId}`)?.value;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const childResult = await supabase
    .from("children")
    .select("id, name, level, emoji, streak, higher_chinese")
    .eq("id", childId)
    .maybeSingle();
  const child = childResult.data as unknown as RevisionChildRow | null;
  if (!child) notFound();

  // A child can revise a different grade's vocab than their own registered
  // level (e.g. reviewing an earlier grade, or previewing ahead) -- the
  // level picker below lets them switch; this just discovers which levels
  // actually have seeded content for the current edition.
  const { data: levelRowsRaw } = await supabase.from("revision_vocab").select("primary_level").eq("edition", EDITION);
  const availableLevels = Array.from(
    new Set(((levelRowsRaw ?? []) as unknown as { primary_level: string }[]).map((r) => r.primary_level))
  ).sort();
  const selectedLevel: string =
    (requestedLevel && availableLevels.includes(requestedLevel) ? requestedLevel : null) ??
    (lastPrimaryLevelCookie && availableLevels.includes(lastPrimaryLevelCookie) ? lastPrimaryLevelCookie : null) ??
    (availableLevels.includes(child.level) ? child.level : null) ??
    availableLevels[0] ??
    child.level;

  const { data: vocabRaw } = await supabase
    .from("revision_vocab")
    .select(
      "id, primary_level, edition, chapter_number, chapter_title, sort, hanzi, pinyin, english, skill, is_higher_chinese, cn_definition, sentence_1, sentence_2, pairing_1, pairing_2, pairing_3, pairing_4"
    )
    .eq("primary_level", selectedLevel)
    .eq("edition", EDITION)
    .order("chapter_number")
    .order("sort");
  const allWords = ((vocabRaw ?? []) as unknown as RevisionVocab[]).filter(
    (w) => child.higher_chinese || !w.is_higher_chinese
  );

  const chapterMap = new Map<number, { title: string; words: RevisionVocab[] }>();
  for (const w of allWords) {
    const existing = chapterMap.get(w.chapter_number);
    if (existing) existing.words.push(w);
    else chapterMap.set(w.chapter_number, { title: w.chapter_title, words: [w] });
  }
  const chapters = Array.from(chapterMap.entries())
    .map(([number, { title, words }]) => ({ number, title, words }))
    .sort((a, b) => a.number - b.number);

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
  const masteryRows = (masteryRaw ?? []) as unknown as RevisionMastery[];
  const masteryByKey = masteryMapFromRows(masteryRows);
  const reviewedThisWeek = weeklyReviewedCount(masteryRows);

  const requestedNumber = requestedChapter ? Number(requestedChapter) : null;
  const cookieNumber = lastChapterCookie ? Number(lastChapterCookie) : null;
  const activeChapter =
    chapters.find((c) => c.number === requestedNumber) ??
    chapters.find((c) => c.number === cookieNumber) ??
    chapters[0] ??
    null;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <RevisionRefresher />
      <div className="w-full max-w-xl">
        <Link
          href={`/kid/${childId}/choose`}
          className="mb-4 inline-block text-base"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--accent-d)" }}>
          词语复习
        </h1>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg">{child.emoji}</span>
            <p className="text-lg font-semibold">
              {child.name}
              <span className="text-lg font-normal ml-3" style={{ color: "var(--mut)" }}>
                {selectedLevel}
              </span>
            </p>
          </div>
          <Link
            href={`/kid/${childId}/vocab/progress`}
            className="card flex items-center gap-1.5 px-4 py-2 shrink-0"
          >
            <span className="text-lg leading-none">🐓</span>
            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--accent-d)" }}>
              Visit Farm
            </span>
          </Link>
        </div>

        <p className="mt-2 text-sm" style={{ color: "var(--mut)" }}>
          {`🔥${child.streak} day${child.streak === 1 ? "" : "s"} in a row`}
        </p>
        <p className="text-sm" style={{ color: "var(--mut)" }}>
          {`You've reviewed ${reviewedThisWeek} word${reviewedThisWeek === 1 ? "" : "s"} this week!`}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm" style={{ color: "var(--mut)" }}>
              Choose primary level:
            </p>
            <PrimaryLevelSelector childId={childId} levels={availableLevels} selectedLevel={selectedLevel} />
          </div>

          {activeChapter && (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm" style={{ color: "var(--mut)" }}>
                Choose chapter:
              </p>
              <ChapterSelector
                childId={childId}
                chapters={chapters.map((c) => ({ number: c.number, title: c.title }))}
                selectedNumber={activeChapter.number}
              />
            </div>
          )}
        </div>

        {activeChapter && (
          <div className="mt-8">
            <div
              className="rounded-[26px] p-6 text-white flex flex-col gap-3"
              style={{
                background: "linear-gradient(135deg,#2C82C9,#5AA7DC)",
                boxShadow: "0 8px 24px rgba(44,130,201,.18)",
              }}
            >
              <p className="text-sm opacity-90">
                {activeChapter.title} · Chapter {String(activeChapter.number).padStart(2, "0")}
              </p>
              <Link href={`/kid/${childId}/vocab/${activeChapter.number}`} className="btn btn-primary self-start">
                ▶ Continue to chapter
              </Link>
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold mb-3 mt-8">My chapters</h2>
        <div className="flex flex-col gap-3">
          {chapters.length === 0 && (
            <p style={{ color: "var(--mut)" }}>
              No chapters for {selectedLevel} yet — check back once they&apos;re added.
            </p>
          )}
          {chapters.map((c) => {
            const isActive = c.number === activeChapter?.number;
            const stage = chapterStage(c.words, masteryByKey);
            return (
              <Link
                key={c.number}
                href={`/kid/${childId}/vocab/${c.number}`}
                className="card flex items-center justify-between p-5"
                style={
                  isActive
                    ? { border: "2px solid var(--accent)", background: "var(--accent-soft)" }
                    : undefined
                }
              >
                <span className="font-semibold">
                  Chapter {String(c.number).padStart(2, "0")} · {c.title}
                </span>
                <span className="text-lg" aria-hidden>
                  {STAGE_EMOJI[stage]}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
