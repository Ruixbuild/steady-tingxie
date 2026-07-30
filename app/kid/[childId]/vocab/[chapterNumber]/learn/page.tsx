import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RevisionChildRow, RevisionMastery, RevisionVocab } from "@/lib/revision/types";
import {
  chapterStage,
  isSkillFlagged,
  masteryMapFromRows,
  skillLevel,
  skillProgress,
  STAGE_EMOJI,
  tracksFor,
} from "@/lib/revision/mastery";
import RevisionRefresher from "@/app/kid/[childId]/vocab/RevisionRefresher";

const EDITION = "huanlehuoban-2025";

export default async function VocabLearnGridPage({
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
  const masteryByKey = masteryMapFromRows((masteryRaw ?? []) as unknown as RevisionMastery[]);
  const stage = chapterStage(words, masteryByKey);
  const readProgress = skillProgress(words, "read", masteryByKey);
  const writeProgress = skillProgress(words, "write", masteryByKey);

  const base = `/kid/${childId}/vocab/${chapterNumber}`;

  // No combined "both" group — a word requiring both skills appears once
  // under 识读 and once under 识写, each entry linking to that specific
  // skill's practice and showing that track's own mastery independently.
  const groups: { label: string; skill: "read" | "write"; words: RevisionVocab[] }[] = [
    { label: "识读", skill: "read" as const, words: words.filter((w) => tracksFor(w.skill).includes("read")) },
    { label: "识写", skill: "write" as const, words: words.filter((w) => tracksFor(w.skill).includes("write")) },
  ].filter((g) => g.words.length > 0);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <RevisionRefresher />
      <div className="w-full max-w-xl">
        <Link href={base} className="mb-4 inline-block text-base" style={{ color: "var(--accent)", fontWeight: 700 }}>
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold mb-2">
          Chapter {chapterNumber} <span className="hanzi">{chapterTitle}</span>
        </h1>
        <p className="mb-3" style={{ color: "var(--mut)" }}>Tap a word to learn.</p>
        <p className="mb-1 flex items-center gap-2 text-sm" style={{ color: "var(--mut)" }}>
          <span className="text-lg">{STAGE_EMOJI[stage]}</span>
          识读 {readProgress.mastered}/{readProgress.total} · 识写 {writeProgress.mastered}/{writeProgress.total}
        </p>
        <p className="mb-6 text-xs" style={{ color: "var(--mut)" }}>
          🥚 new → 🐣 learning → 🐥 almost → 🐔 mastered · tests grow words fastest
        </p>

        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--mut)" }}>
                {g.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {g.words.map((w) => (
                  <Link
                    key={`${g.skill}-${w.id}`}
                    href={`${base}/learn/${w.id}?skill=${g.skill}`}
                    className="hanzi flex items-center gap-1 rounded-2xl px-3 py-2 text-lg"
                    style={{ background: "#fff", border: "1.5px solid var(--line)" }}
                  >
                    {isSkillFlagged(w.id, g.skill, masteryByKey) && <span className="text-sm">🚩</span>}
                    {w.hanzi}
                    <span className="text-sm">{STAGE_EMOJI[skillLevel(w.id, g.skill, masteryByKey)]}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
