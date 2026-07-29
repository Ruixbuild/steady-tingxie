"use client";

// All-chapters version of the per-chapter zoo (../[chapterNumber]/progress/
// ZooClient.tsx) -- same overall-completion card and STAGE_EMOJI stage set,
// but aggregated across every chapter's words at once instead of one
// chapter's. chapterStage/skillProgress/isWordMastered are already pure
// functions over whatever word list is passed in, so this reuses them
// unchanged rather than introducing chapter-aware variants.

import Link from "next/link";
import { chapterStage, isWordMastered, masteryMapFromRows, skillProgress, STAGE_EMOJI } from "@/lib/revision/mastery";
import type { ChapterSummary, RevisionMastery } from "@/lib/revision/types";

export default function AllChaptersZooClient({
  childId,
  chapters,
  masteryRows,
}: {
  childId: string;
  chapters: ChapterSummary[];
  masteryRows: RevisionMastery[];
}) {
  const masteryByKey = masteryMapFromRows(masteryRows);
  const allWords = chapters.flatMap((c) => c.words);

  const readProgress = skillProgress(allWords, "read", masteryByKey);
  const writeProgress = skillProgress(allWords, "write", masteryByKey);
  const total = readProgress.total + writeProgress.total;
  const grown = readProgress.mastered + writeProgress.mastered;
  const pct = total > 0 ? Math.round((grown / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5 flex flex-col gap-3 items-center text-center">
        <span className="text-4xl">🦁</span>
        <p className="font-semibold text-lg">
          {grown}/{total} mastered
        </p>
        <div className="w-full rounded-full overflow-hidden" style={{ background: "var(--line)", height: 10 }}>
          <div style={{ width: `${pct}%`, background: "var(--ok)", height: "100%" }} />
        </div>
        <p className="text-xs" style={{ color: "var(--mut)" }}>
          🥚 new → 🐣 learning → 🐥 almost → 🐔 mastered · tests grow words fastest
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {chapters.map((c) => {
          const stage = chapterStage(c.words, masteryByKey);
          const masteredCount = c.words.filter((w) => isWordMastered(w, masteryByKey)).length;
          return (
            <Link
              key={c.chapterNumber}
              href={`/kid/${childId}/vocab/${c.chapterNumber}/progress`}
              className="card flex items-center justify-between p-4"
            >
              <span className="font-semibold">
                Chapter {String(c.chapterNumber).padStart(2, "0")} · {c.chapterTitle}
              </span>
              <span className="flex items-center gap-2 text-sm" style={{ color: "var(--mut)" }}>
                {masteredCount}/{c.words.length}
                <span className="text-lg" aria-hidden>
                  {STAGE_EMOJI[stage]}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
