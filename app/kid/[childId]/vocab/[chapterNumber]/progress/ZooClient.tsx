"use client";

// Revision's own progress visualization — same underlying mastery-stage
// concept as TingXie's GardenClient (per-word/track stage badge, a
// weak-words callout, a completion bar), but re-skinned as a zoo rather
// than a garden per the chapter hub's existing "🦁 my vocab zoo" framing.
// Deliberately a new component rather than reusing GardenClient, which is
// TingXie's own and keyed on TingXie's mastery/char_misses schema.
//
// The mastery stage symbols themselves (STAGE_EMOJI) are also
// Revision-specific -- egg/hatched egg/chick/chicken, not TingXie's plant
// set -- per the "different mastery symbol in vocab revision vs tingxie"
// design call.

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
import type { RevisionAttempt, RevisionMastery, RevisionVocab } from "@/lib/revision/types";

const STAGE_LABEL = ["New", "Learning", "Almost", "Mastered"];

export default function ZooClient({
  base,
  allChaptersHref,
  words,
  masteryRows,
  recentAttempts,
}: {
  base: string;
  allChaptersHref: string;
  words: RevisionVocab[];
  masteryRows: RevisionMastery[];
  recentAttempts: RevisionAttempt[];
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
      <Link href={allChaptersHref} className="text-sm self-start" style={{ color: "var(--accent)", fontWeight: 700 }}>
        ← All chapters
      </Link>

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

      {renderGroup(readWords, "read", "👁 识读")}
      {renderGroup(writeWords, "write", "✍️ 识写")}

      {recentAttempts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--mut)" }}>
            📊 Recent tests
          </p>
          <div className="flex flex-col gap-2">
            {recentAttempts.map((a) => (
              <div key={a.id} className="card flex items-center justify-between px-4 py-3">
                <span>
                  {a.skill === "read" ? "👁" : "✍️"} L{a.test_level}
                </span>
                <span className="text-sm" style={{ color: "var(--mut)" }}>
                  {a.taken_at.slice(0, 10)}
                </span>
                <span className="font-semibold">
                  {a.score}/{a.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
