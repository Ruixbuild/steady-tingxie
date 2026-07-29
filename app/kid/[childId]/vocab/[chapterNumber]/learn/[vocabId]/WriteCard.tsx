"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import CharLadder from "@/app/kid/[childId]/list/[listId]/learn/CharLadder";
import { strokeChars } from "@/lib/hanzi";
import { STAGE_EMOJI } from "@/lib/revision/mastery";
import { touchMastery } from "@/lib/revision/masteryActions";
import { stripPunctuation } from "@/lib/revision/narration";
import type { RevisionVocab } from "@/lib/revision/types";

const SKILL_LABEL: Record<RevisionVocab["skill"], string> = {
  read: "识读",
  write: "识写",
  both: "识读 · 识写",
};

export default function WriteCard({
  childId,
  gridHref,
  word,
  initialLevel,
}: {
  childId: string;
  gridHref: string;
  word: RevisionVocab;
  initialLevel: number;
}) {
  const [mode, setMode] = useState<"card" | "practice" | "done">("card");
  const [expanded, setExpanded] = useState(false);
  const [charIndex, setCharIndex] = useState(0);
  const epochRef = useRef(0);
  const chars = strokeChars(word.hanzi);

  async function finishPractice() {
    await touchMastery(childId, word.id, "write");
    setMode("done");
  }

  async function handleCharDone() {
    if (charIndex + 1 < chars.length) {
      setCharIndex((i) => i + 1);
      return;
    }
    await finishPractice();
  }

  const pairings = [word.pairing_1, word.pairing_2, word.pairing_3, word.pairing_4].filter(
    (p): p is string => Boolean(p)
  );

  if (mode === "done") {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl flex flex-col items-center gap-6 py-12 text-center">
          <span className="text-5xl">🌸</span>
          <h1 className="text-2xl font-semibold">写得好!</h1>
          <p style={{ color: "var(--mut)" }}>
            <span className="hanzi">{word.hanzi}</span> practised
          </p>
          <Link href={gridHref} className="btn btn-primary">
            Back to word list
          </Link>
        </div>
      </main>
    );
  }

  if (mode === "practice") {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl flex flex-col gap-6">
          <div className="text-center">
            <p className="text-base" style={{ color: "var(--mut)" }}>
              <span className="hanzi">{word.hanzi}</span> · character {charIndex + 1} of {chars.length}
            </p>
          </div>

          <button type="button" onClick={finishPractice} className="btn btn-sm btn-secondary self-center">
            ✓ I know this
          </button>

          {chars.length > 1 && (
            <div className="flex gap-2 justify-center flex-wrap">
              {chars.map((c, i) => {
                const done = i < charIndex;
                const on = i === charIndex;
                return (
                  <span
                    key={i}
                    className="hanzi flex items-center justify-center"
                    style={{
                      minWidth: 44,
                      height: 44,
                      fontSize: "1.3rem",
                      borderRadius: 12,
                      border: `1.5px solid ${on ? "var(--accent)" : done ? "var(--ok)" : "var(--line)"}`,
                      background: on ? "var(--accent-soft)" : done ? "var(--ok-soft)" : "#fff",
                      color: on ? "var(--accent-d)" : "var(--ink)",
                    }}
                  >
                    {c}
                  </span>
                );
              })}
            </div>
          )}

          <CharLadder
            key={`${word.id}-${charIndex}`}
            char={chars[charIndex]}
            announceWord={charIndex === 0 ? stripPunctuation(word.hanzi) : undefined}
            word={stripPunctuation(word.hanzi)}
            kind="words"
            skipWatch={false}
            epochRef={epochRef}
            onDone={handleCharDone}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-4">
        <Link href={gridHref} className="inline-block text-base" style={{ color: "var(--accent)", fontWeight: 700 }}>
          ← Back
        </Link>

        <div className="card p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span
              className="text-sm font-semibold rounded-full px-3 py-1"
              style={{ background: "var(--accent-soft)", color: "var(--accent-d)" }}
            >
              {SKILL_LABEL[word.skill]}
            </span>
            <span className="text-lg">{STAGE_EMOJI[Math.min(initialLevel, 3)]}</span>
          </div>

          <h1 className="hanzi text-4xl font-extrabold">{word.hanzi}</h1>
          <p style={{ color: "var(--mut)" }}>{word.pinyin}</p>
          <p className="text-lg">{word.english}</p>
          {word.cn_definition && <p style={{ color: "var(--mut)" }}>{word.cn_definition}</p>}

          {(word.sentence_1 || word.sentence_2 || pairings.length > 0) && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="btn btn-sm btn-secondary self-start"
              >
                {expanded ? "收起" : "造句 · 搭配"}
              </button>
              {expanded && (
                <div className="flex flex-col gap-2 mt-1">
                  {pairings.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold mb-1" style={{ color: "var(--mut)" }}>
                        搭配
                      </p>
                      <p className="hanzi">{pairings.join(" · ")}</p>
                    </div>
                  )}
                  {(word.sentence_1 || word.sentence_2) && (
                    <div>
                      <p className="text-sm font-semibold mb-1" style={{ color: "var(--mut)" }}>
                        造句
                      </p>
                      {word.sentence_1 && <p className="hanzi">{word.sentence_1}</p>}
                      {word.sentence_2 && <p className="hanzi">{word.sentence_2}</p>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <button type="button" onClick={() => setMode("practice")} className="btn btn-primary self-start">
          ▶ Start writing practice
        </button>
      </div>
    </main>
  );
}
