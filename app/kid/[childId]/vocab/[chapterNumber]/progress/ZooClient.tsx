"use client";

// Revision's own progress visualization — same underlying mastery-stage
// concept as TingXie's GardenClient (per-word/track stage badge, a
// weak-words callout, a completion bar), but re-skinned as a zoo rather
// than a garden per the chapter hub's existing "🦁 my vocab zoo" framing.
// Deliberately a new component rather than reusing GardenClient, which is
// TingXie's own and keyed on TingXie's mastery/char_misses schema.

import Link from "next/link";
import {
  isSkillFlagged,
  masteryKey,
  masteryMapFromRows,
  skillLevel,
  skillProgress,
  STAGE_EMOJI,
  tracksFor,
} from "@/lib/revision/mastery";
import type { RevisionMastery, RevisionVocab } from "@/lib/revision/types";

// The zoo page is Revision's own naming/chrome for this screen (🦁 mascot,
// "my vocab zoo" caption on the chapter hub), but the actual mastery stage
// indicator per word/track stays the same 🌱🌿🌸🌳 plant set used everywhere
// else in Revision (Learn grid, chapter hub chips) and mirroring TingXie's
// own mastery-stage convention -- one stage vocabulary across the whole
// app, not a zoo-specific reskin.
const STAGE_LABEL = ["New", "Learning", "Almost", "Mastered"];

export default function ZooClient({
  base,
  words,
  masteryRows,
}: {
  base: string;
  words: RevisionVocab[];
  masteryRows: RevisionMastery[];
}) {
  const masteryByKey = masteryMapFromRows(masteryRows);

  const readWords = words.filter((w) => tracksFor(w.skill).includes("read"));
  const writeWords = words.filter((w) => tracksFor(w.skill).includes("write"));
  const readProgress = skillProgress(words, "read", masteryByKey);
  const writeProgress = skillProgress(words, "write", masteryByKey);
  const total = readProgress.total + writeProgress.total;
  const grown = readProgress.mastered + writeProgress.mastered;
  const pct = total > 0 ? Math.round((grown / total) * 100) : 0;

  function isTricky(vocabId: string, skill: "read" | "write") {
    const m = masteryByKey.get(masteryKey(vocabId, skill));
    return (m?.flagged ?? false) || (m?.misses ?? 0) > 0 || (m?.level ?? 0) < 2;
  }

  const hasTricky =
    readWords.some((w) => isTricky(w.id, "read")) || writeWords.some((w) => isTricky(w.id, "write"));

  function renderGroup(list: RevisionVocab[], skill: "read" | "write", label: string) {
    if (list.length === 0) return null;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--mut)" }}>
          {label}
        </p>
        <div className="flex flex-wrap gap-3">
          {list.map((w) => {
            const level = skillLevel(w.id, skill, masteryByKey);
            return (
              <div
                key={`${skill}-${w.id}`}
                className="card flex flex-col items-center gap-1 px-3 py-3"
                style={{ minWidth: 76, position: "relative" }}
              >
                {isSkillFlagged(w.id, skill, masteryByKey) && (
                  <span className="text-xs" style={{ position: "absolute", top: 4, right: 6 }}>
                    🚩
                  </span>
                )}
                <span className="text-2xl">{STAGE_EMOJI[level]}</span>
                <span className="hanzi text-base font-semibold">{w.hanzi}</span>
                <span className="text-xs" style={{ color: "var(--mut)" }}>
                  {STAGE_LABEL[level]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
          🌱 new → 🌿 learning → 🌸 almost → 🌳 mastered · tests grow words fastest
        </p>
      </div>

      {renderGroup(readWords, "read", "👁 识读")}
      {renderGroup(writeWords, "write", "✍️ 识写")}

      {hasTricky && (
        <div className="flex flex-col gap-3">
          <Link href={`${base}/learn`} className="btn btn-primary text-center">
            Practice in Learn
          </Link>
          <Link href={`${base}/test`} className="btn btn-secondary text-center">
            Test weak words
          </Link>
        </div>
      )}
    </div>
  );
}
