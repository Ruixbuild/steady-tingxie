"use client";

// Chains several skill+level "legs" of tricky words (pulled from every
// chapter the child has started, see the server page's buildTrickyLegs
// call) into one session — TestRunner already handles a single skill+level
// run end to end, so this component's whole job is deciding which leg runs
// next and rendering the combined summary once every leg is done, via
// TestRunner's onLegComplete escape hatch (see that file's own doc comment
// on the prop for why a per-leg ResultsScreen would read as the session
// ending early).

import { useState } from "react";
import Link from "next/link";
import TestRunner from "../[chapterNumber]/test/TestRunner";
import type { WordResult } from "../[chapterNumber]/test/ResultsScreen";
import type { TrickyLeg } from "@/lib/revision/testScoring";
import type { RevisionVocab } from "@/lib/revision/types";

const SKILL_LABEL: Record<"read" | "write", string> = { read: "识读", write: "识写" };

type LegResult = { skill: "read" | "write"; level: 1 | 2; results: WordResult[]; failedCount: number };

export default function CrossChapterTestHost({
  childId,
  legs,
  chapterWords,
  learntWords,
  backHref,
}: {
  childId: string;
  legs: TrickyLeg[];
  chapterWords: RevisionVocab[];
  learntWords: RevisionVocab[];
  backHref: string;
}) {
  const [legIndex, setLegIndex] = useState(0);
  const [legResults, setLegResults] = useState<LegResult[]>([]);
  const [exited, setExited] = useState(false);

  if (exited) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl flex flex-col items-center gap-4 text-center">
          <p style={{ color: "var(--mut)" }}>Practice ended early.</p>
          <Link href={backHref} className="btn btn-primary">
            Back to vocabulary hub
          </Link>
        </div>
      </main>
    );
  }

  const currentLeg = legs[legIndex];

  if (!currentLeg) {
    const totalScore = legResults.reduce((n, l) => n + l.results.filter((r) => r.passed).length, 0);
    const totalWords = legResults.reduce((n, l) => n + l.results.length, 0);
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-semibold">🎉 Tricky words practice complete!</h1>
          <p className="text-3xl font-extrabold">
            {totalScore} / {totalWords}
          </p>
          <div className="flex flex-col gap-3 w-full">
            {legResults.map((lr, i) => {
              const score = lr.results.filter((r) => r.passed).length;
              return (
                <div key={i} className="card p-4 text-left flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {SKILL_LABEL[lr.skill]} Level {lr.level}
                    </span>
                    <span style={{ color: "var(--mut)" }}>
                      {score} / {lr.results.length}
                    </span>
                  </div>
                  {lr.failedCount > 0 && (
                    <p className="text-xs" style={{ color: "var(--miss)" }}>
                      ⚠ {lr.failedCount} result{lr.failedCount > 1 ? "s" : ""} didn&apos;t save.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {lr.results.map((r, j) => (
                      <span
                        key={j}
                        className="hanzi rounded-xl px-2 py-1 text-sm"
                        style={{
                          background: r.passed ? "var(--ok-soft)" : "var(--miss-soft)",
                          color: r.passed ? "#1D6E47" : "var(--miss)",
                          border: `1.5px solid ${r.passed ? "var(--ok)" : "var(--miss)"}`,
                        }}
                      >
                        {r.passed ? "✓" : "✗"} {r.hanzi}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <Link href={backHref} className="btn btn-primary">
            Back to vocabulary hub
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <TestRunner
          key={legIndex}
          childId={childId}
          chapterNumber={null}
          chapterHref={backHref}
          onExit={() => setExited(true)}
          skill={currentLeg.skill}
          level={currentLeg.level}
          words={currentLeg.words}
          chapterWords={chapterWords}
          learntWords={learntWords}
          modeLabel={`${SKILL_LABEL[currentLeg.skill]} Level ${currentLeg.level} — tricky words (${
            legIndex + 1
          }/${legs.length})`}
          onLegComplete={(results, failedCount) => {
            setLegResults((prev) => [...prev, { skill: currentLeg.skill, level: currentLeg.level, results, failedCount }]);
            setLegIndex((i) => i + 1);
          }}
        />
      </div>
    </main>
  );
}
