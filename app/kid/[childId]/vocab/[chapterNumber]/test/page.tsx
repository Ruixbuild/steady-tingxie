import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RevisionChildRow, RevisionMastery, RevisionVocab } from "@/lib/revision/types";
import { masteryMapFromRows, tracksFor } from "@/lib/revision/mastery";
import { defaultTestLevel, findPairingWithWord } from "@/lib/revision/testScoring";
import TestRunner from "./TestRunner";

const EDITION = "huanlehuoban-2025";

export default async function VocabTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string; chapterNumber: string }>;
  searchParams: Promise<{ skill?: string; level?: string }>;
}) {
  const { childId, chapterNumber: chapterNumberParam } = await params;
  const { skill: skillParam, level: levelParam } = await searchParams;
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

  const { data: vocabRaw } = await supabase
    .from("revision_vocab")
    .select(
      "id, primary_level, edition, chapter_number, chapter_title, sort, hanzi, pinyin, english, skill, is_higher_chinese, cn_definition, sentence_1, sentence_2, pairing_1, pairing_2, pairing_3, pairing_4"
    )
    .eq("primary_level", child.level)
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
  const masteryByKey = masteryMapFromRows((masteryRaw ?? []) as unknown as RevisionMastery[]);

  const base = `/kid/${childId}/vocab/${chapterNumber}`;

  const readWords = words.filter((w) => tracksFor(w.skill).includes("read"));
  const writeWords = words.filter((w) => tracksFor(w.skill).includes("write"));
  const readWordsL2 = readWords.filter((w) => findPairingWithWord(w) !== null);
  const writeWordsL2 = writeWords.filter((w) => findPairingWithWord(w) !== null);

  const skill = skillParam === "read" || skillParam === "write" ? skillParam : null;
  const level = levelParam === "1" || levelParam === "2" ? (Number(levelParam) as 1 | 2) : null;

  if (skill && level) {
    const runWords = skill === "read" ? readWords : writeWords;
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl">
          <TestRunner childId={childId} base={`${base}/test`} skill={skill} level={level} words={runWords} chapterWords={words} />
        </div>
      </main>
    );
  }

  const cards: { skill: "read" | "write"; level: 1 | 2; label: string; count: number; suggested: boolean }[] = [
    { skill: "read", level: 1, label: "识读 Level 1 · listen & pick", count: readWords.length, suggested: false },
    { skill: "read", level: 2, label: "识读 Level 2 · match the phrase", count: readWordsL2.length, suggested: false },
    { skill: "write", level: 1, label: "识写 Level 1 · write from memory", count: writeWords.length, suggested: false },
    { skill: "write", level: 2, label: "识写 Level 2 · fill in the blank", count: writeWordsL2.length, suggested: false },
  ];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <Link href={base} className="mb-4 inline-block text-base" style={{ color: "var(--accent)", fontWeight: 700 }}>
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold mb-1">Test</h1>
        <p className="mb-6" style={{ color: "var(--mut)" }}>
          Choose a format to test
        </p>

        <div className="flex flex-col gap-3">
          {cards.map((c) => {
            const suggestedLevel =
              c.skill === "read"
                ? readWords.length > 0
                  ? defaultTestLevel(readWords[0].id, "read", masteryByKey)
                  : 1
                : writeWords.length > 0
                  ? defaultTestLevel(writeWords[0].id, "write", masteryByKey)
                  : 1;
            const isSuggested = suggestedLevel === c.level;
            return (
              <Link
                key={`${c.skill}-${c.level}`}
                href={c.count > 0 ? `${base}/test?skill=${c.skill}&level=${c.level}` : "#"}
                className="card flex items-center justify-between p-5"
                style={c.count === 0 ? { opacity: 0.5, pointerEvents: "none" } : undefined}
              >
                <span className="font-semibold">
                  {c.label}
                  {isSuggested && (
                    <span className="text-sm ml-2" style={{ color: "var(--accent)" }}>
                      · suggested
                    </span>
                  )}
                </span>
                <span className="text-sm" style={{ color: "var(--mut)" }}>
                  {c.count} words
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
