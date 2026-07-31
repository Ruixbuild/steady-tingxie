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
  // Tricky-only used to be a whole separate card per level ("Level 1",
  // "Level 1 · tricky words only", "Level 2", "Level 2 · tricky words
  // only", ...) which doubled the picker's card count and read as
  // cluttered once 识写's own two cards were mixed in among them. A single
  // toggle above 识读's cards (the only skill tricky-only applies to)
  // re-scopes its existing Level 1/2 cards instead of adding new ones.
  const [readTrickyOnly, setReadTrickyOnly] = useState(false);

  const readWords = words.filter((w) => tracksFor(w.skill).includes("read"));
  const writeWords = words.filter((w) => tracksFor(w.skill).includes("write"));
  const readWordsL2 = readWords.filter((w) => findPairingWithWord(w) !== null);
  const writeWordsL2 = writeWords.filter((w) => findPairingWithWord(w) !== null);
  const readTrickyWords = readWords.filter((w) => isTricky(w.id, "read", masteryByKey));
  const readTrickyWordsL2 = readTrickyWords.filter((w) => findPairingWithWord(w) !== null);

  function readRunWords(level: 1 | 2, tricky: boolean) {
    if (tricky) return level === 1 ? readTrickyWords : readTrickyWordsL2;
    return level === 1 ? readWords : readWordsL2;
  }

  if (active) {
    const runWords =
      active.skill === "read" ? readRunWords(active.level, active.tricky ?? false) : writeWords;
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
            modeLabel={active.tricky ? `识读 Level ${active.level} — tricky words only` : undefined}
          />
        </div>
      </main>
    );
  }

  const readCards: { level: 1 | 2; label: string }[] = [
    { level: 1, label: "Level 1 · listen & pick" },
    { level: 2, label: "Level 2 · match the phrase" },
  ];
  const writeCards: { level: 1 | 2; label: string; count: number }[] = [
    { level: 1, label: "Level 1 · write from memory", count: writeWords.length },
    { level: 2, label: "Level 2 · fill in the blank", count: writeWordsL2.length },
  ];

  function renderCard(opts: {
    key: string;
    label: string;
    count: number;
    isSuggested: boolean;
    isFaint: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        key={opts.key}
        type="button"
        disabled={opts.count === 0}
        onClick={opts.onClick}
        className="card flex items-center justify-between p-5 text-left"
        style={opts.count === 0 ? { opacity: 0.5, cursor: "default" } : opts.isFaint ? { opacity: 0.55 } : undefined}
      >
        <span className="font-semibold">
          {opts.label}
          {opts.isSuggested && (
            <span className="text-sm ml-2" style={{ color: "var(--accent)" }}>
              · suggested
            </span>
          )}
        </span>
        <span className="text-sm" style={{ color: "var(--mut)" }}>
          {opts.count} words
        </span>
      </button>
    );
  }

  // Warms the first word's audio right as the tap happens — TestRunner's
  // own look-ahead prefetch only covers the second word onward, since it
  // needs a "current" item already mounted to look ahead from. This is the
  // one moment before that where there's still time to beat the fetch
  // before the child sees the first item.
  function prefetchFirst(runWords: RevisionVocab[], level: 1 | 2) {
    const firstWord = level === 1 ? runWords[0] : runWords.find((w) => findPairingWithWord(w) !== null);
    if (firstWord) prefetchRevision(firstWord.hanzi);
  }

  const readSuggestedLevel = defaultTestLevelForWords(readWords, "read", masteryByKey);
  const writeSuggestedLevel = defaultTestLevelForWords(writeWords, "write", masteryByKey);

  // suggestedLevel is null once every word for that skill is fully
  // mastered (level 3) — there's nothing left to suggest, so both level
  // cards dim instead of one staying highlighted as "suggested" forever.
  function isCardSuggested(suggestedLevel: 1 | 2 | null, level: 1 | 2): boolean {
    return suggestedLevel !== null && suggestedLevel === level;
  }
  function isCardFaint(suggestedLevel: 1 | 2 | null, level: 1 | 2): boolean {
    return suggestedLevel === null || level < suggestedLevel;
  }

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

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: "var(--mut)" }}>
                👁 识读
              </p>
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--mut)" }}>
                <input
                  type="checkbox"
                  checked={readTrickyOnly}
                  onChange={(e) => setReadTrickyOnly(e.target.checked)}
                />
                Tricky words only
              </label>
            </div>
            {readCards.map((c) => {
              const count = readRunWords(c.level, readTrickyOnly).length;
              // Tricky-only is a re-practice filter, not a step in the
              // adaptive level-1-then-level-2 progression, so it never
              // shows the suggested/faint badging below.
              const isSuggested = !readTrickyOnly && isCardSuggested(readSuggestedLevel, c.level);
              const isFaint = !readTrickyOnly && isCardFaint(readSuggestedLevel, c.level);
              return renderCard({
                key: `read-${c.level}`,
                label: `识读 ${c.label}`,
                count,
                isSuggested,
                isFaint,
                onClick: () => {
                  const runWords = readRunWords(c.level, readTrickyOnly);
                  prefetchFirst(runWords, c.level);
                  setActive({ skill: "read", level: c.level, tricky: readTrickyOnly });
                },
              });
            })}
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold" style={{ color: "var(--mut)" }}>
              ✍️ 识写
            </p>
            {writeCards.map((c) => {
              const isSuggested = isCardSuggested(writeSuggestedLevel, c.level);
              const isFaint = isCardFaint(writeSuggestedLevel, c.level);
              return renderCard({
                key: `write-${c.level}`,
                label: `识写 ${c.label}`,
                count: c.count,
                isSuggested,
                isFaint,
                onClick: () => {
                  prefetchFirst(writeWords, c.level);
                  setActive({ skill: "write", level: c.level });
                },
              });
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
