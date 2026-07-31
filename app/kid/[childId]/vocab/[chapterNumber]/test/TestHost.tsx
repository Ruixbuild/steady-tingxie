"use client";

// Picker + runner in one client component, switching via local state
// instead of a <Link>-driven route/searchParams change. That distinction
// matters for narration: a real Next.js navigation (the original approach
// here) re-fetches the RSC payload before TestRunner even mounts, putting
// enough async distance between the tap and the first word's speakRevision
// call that browsers block the auto-play — the same reason Learn's
// WriteCard (a local mode="card"→"practice" state toggle, no navigation)
// doesn't have this problem. Switching this screen to the same
// same-page-state-transition pattern fixes it here too.

import { useState } from "react";
import Link from "next/link";
import TestRunner from "./TestRunner";
import { isTricky, masteryMapFromRows, tracksFor } from "@/lib/revision/mastery";
import { prefetchRevision } from "@/lib/revision/narration";
import { defaultTestLevelForWords, findPairingWithWord } from "@/lib/revision/testScoring";
import type { RevisionMastery, RevisionVocab } from "@/lib/revision/types";

type Active = { skill: "read" | "write"; level: 1 | 2; tricky?: boolean };

export default function TestHost({
  childId,
  chapterNumber,
  base,
  words,
  masteryRows,
  learntWords,
}: {
  childId: string;
  chapterNumber: number;
  base: string;
  words: RevisionVocab[];
  masteryRows: RevisionMastery[];
  /** Words (any chapter) this child already has read-mastery for — passed
   * straight through to TestRunner as the fallback distractor pool. */
  learntWords: RevisionVocab[];
}) {
  const masteryByKey = masteryMapFromRows(masteryRows);
  const [active, setActive] = useState<Active | null>(null);

  const readWords = words.filter((w) => tracksFor(w.skill).includes("read"));
  const writeWords = words.filter((w) => tracksFor(w.skill).includes("write"));
  const readWordsL2 = readWords.filter((w) => findPairingWithWord(w) !== null);
  const writeWordsL2 = writeWords.filter((w) => findPairingWithWord(w) !== null);
  const readTrickyWords = readWords.filter((w) => isTricky(w.id, "read", masteryByKey));

  if (active) {
    const runWords = active.tricky ? readTrickyWords : active.skill === "read" ? readWords : writeWords;
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl">
          <TestRunner
            childId={childId}
            chapterNumber={chapterNumber}
            chapterHref={base}
            onExit={() => setActive(null)}
            skill={active.skill}
            level={active.level}
            words={runWords}
            chapterWords={words}
            learntWords={learntWords}
            modeLabel={active.tricky ? "识读 Level 1 — tricky words only" : undefined}
          />
        </div>
      </main>
    );
  }

  const cards: { skill: "read" | "write"; level: 1 | 2; label: string; count: number; tricky?: boolean }[] = [
    { skill: "read", level: 1, label: "识读 Level 1 · listen & pick", count: readWords.length },
    { skill: "read", level: 1, label: "识读 Level 1 · tricky words only", count: readTrickyWords.length, tricky: true },
    { skill: "read", level: 2, label: "识读 Level 2 · match the phrase", count: readWordsL2.length },
    { skill: "write", level: 1, label: "识写 Level 1 · write from memory", count: writeWords.length },
    { skill: "write", level: 2, label: "识写 Level 2 · fill in the blank", count: writeWordsL2.length },
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
            // The tricky-words-only mode is a re-practice tool, not a step
            // in the adaptive level-1-then-level-2 progression, so it never
            // participates in the suggested/faint badging below.
            const suggestedLevel = c.tricky
              ? null
              : c.skill === "read"
                ? defaultTestLevelForWords(readWords, "read", masteryByKey)
                : defaultTestLevelForWords(writeWords, "write", masteryByKey);
            const isSuggested = suggestedLevel !== null && suggestedLevel === c.level;
            // Once a lower level's word has passed enough to bump the
            // suggestion up (e.g. a Level 1 pass suggesting Level 2 next),
            // that lower level is still tappable -- for re-practice -- but
            // is de-emphasized rather than looking like an equally live
            // option next to the new "· suggested" one.
            const isFaint = suggestedLevel !== null && c.level < suggestedLevel;
            return (
              <button
                key={`${c.skill}-${c.level}-${c.tricky ? "tricky" : "all"}`}
                type="button"
                disabled={c.count === 0}
                onClick={() => {
                  // Warms the first word's audio right as the tap happens —
                  // TestRunner's own look-ahead prefetch (see its useEffect)
                  // only covers the second word onward, since it needs a
                  // "current" item already mounted to look ahead from. This
                  // is the one moment before that where there's still time
                  // to beat the fetch before the child sees the first item.
                  const runWords = c.tricky ? readTrickyWords : c.skill === "read" ? readWords : writeWords;
                  const firstWord = c.level === 1 ? runWords[0] : runWords.find((w) => findPairingWithWord(w) !== null);
                  if (firstWord) prefetchRevision(firstWord.hanzi);
                  setActive({ skill: c.skill, level: c.level, tricky: c.tricky });
                }}
                className="card flex items-center justify-between p-5 text-left"
                style={
                  c.count === 0
                    ? { opacity: 0.5, cursor: "default" }
                    : isFaint
                      ? { opacity: 0.55 }
                      : undefined
                }
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
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
