"use client";

import Link from "next/link";

export type WordResult = { hanzi: string; passed: boolean };

const TITLE: Record<"read" | "write", Record<1 | 2, string>> = {
  read: { 1: "识读 Level 1 results", 2: "识读 Level 2 results" },
  write: { 1: "识写 Level 1 results", 2: "识写 Level 2 results" },
};

// One results screen per skill+level combo, never blended — per the
// wireframe review, a 识读 attempt and a 识写 attempt are separate test
// paths and shouldn't be scored together.
export default function ResultsScreen({
  skill,
  level,
  results,
  backHref,
}: {
  skill: "read" | "write";
  level: 1 | 2;
  results: WordResult[];
  backHref: string;
}) {
  const score = results.filter((r) => r.passed).length;
  const total = results.length;

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <h1 className="text-2xl font-semibold">{TITLE[skill][level]}</h1>
      <p className="text-3xl font-extrabold">
        {score} / {total}
      </p>

      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {results.map((r, i) => (
          <span
            key={i}
            className="hanzi rounded-2xl px-3 py-2"
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

      <Link href={backHref} className="btn btn-primary">
        Back to chapter
      </Link>
    </div>
  );
}
