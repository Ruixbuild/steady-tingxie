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
import { masteryMapFromRows, tracksFor } from "@/lib/revision/mastery";
import { defaultTestLevel, findPairingWithWord } from "@/lib/revision/testScoring";
import type { RevisionMastery, RevisionVocab } from "@/lib/revision/types";

type Active = { skill: "read" | "write"; level: 1 | 2 };

export default function TestHost({
  childId,
  base,
  words,
  masteryRows,
}: {
  childId: string;
  base: string;
  words: RevisionVocab[];
  masteryRows: RevisionMastery[];
}) {
  const masteryByKey = masteryMapFromRows(masteryRows);
  const [active, setActive] = useState<Active | null>(null);

  const readWords = words.filter((w) => tracksFor(w.skill).includes("read"));
  const writeWords = words.filter((w) => tracksFor(w.skill).includes("write"));
  const readWordsL2 = readWords.filter((w) => findPairingWithWord(w) !== null);
  const writeWordsL2 = writeWords.filter((w) => findPairingWithWord(w) !== null);

  if (active) {
    const runWords = active.skill === "read" ? readWords : writeWords;
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl">
          <TestRunner
            childId={childId}
            chapterHref={base}
            onExit={() => setActive(null)}
            skill={active.skill}
            level={active.level}
            words={runWords}
            chapterWords={words}
          />
        </div>
      </main>
    );
  }

  const cards: { skill: "read" | "write"; level: 1 | 2; label: string; count: number }[] = [
    { skill: "read", level: 1, label: "识读 Level 1 · listen & pick", count: readWords.length },
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
              <button
                key={`${c.skill}-${c.level}`}
                type="button"
                disabled={c.count === 0}
                onClick={() => setActive({ skill: c.skill, level: c.level })}
                className="card flex items-center justify-between p-5 text-left"
                style={c.count === 0 ? { opacity: 0.5, cursor: "default" } : undefined}
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
