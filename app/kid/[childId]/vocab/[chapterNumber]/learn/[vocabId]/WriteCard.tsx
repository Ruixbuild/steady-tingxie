"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import StrokeLadder from "@/app/kid/[childId]/vocab/StrokeLadder";
import { strokeChars } from "@/lib/hanzi";
import { touchMastery } from "@/lib/revision/masteryActions";
import { prefetchRevision, speakRevision, stripPunctuation } from "@/lib/revision/narration";
import type { RevisionVocab } from "@/lib/revision/types";

// Mirrors ReadCard.tsx's initial card layout exactly (flag badge, speak
// buttons throughout, no collapse/expand toggle) -- the only differences
// are the "识写" badge and the "Start writing practice" button appended
// below the card, which advances into this component's own practice/done
// states (识读 has no equivalent practice flow).
function SpeakButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => speakRevision(text)}
      aria-label={`Play ${text}`}
      className="inline-flex items-center justify-center"
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: "1.5px solid var(--line)",
        background: "#fff",
        flexShrink: 0,
      }}
    >
      🔊
    </button>
  );
}

export default function WriteCard({
  childId,
  gridHref,
  word,
  initialFlagged,
}: {
  childId: string;
  gridHref: string;
  word: RevisionVocab;
  initialFlagged: boolean;
}) {
  const [mode, setMode] = useState<"card" | "practice" | "done">("card");
  const [flagged, setFlagged] = useState(initialFlagged);
  const [charIndex, setCharIndex] = useState(0);
  const epochRef = useRef(0);
  const chars = strokeChars(word.hanzi);

  useEffect(() => {
    touchMastery(childId, word.id, "write");
    // Fires once when the card is opened — recency/exposure tracking only,
    // same as ReadCard's mount effect (finishPractice below separately
    // bumps level once practice completes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);

  useEffect(() => {
    // Same reasoning as ReadCard's mount prefetch: warms every speakable
    // text here (including the stripped word text StrokeLadder auto-
    // announces once practice starts) while the card is still being read,
    // so neither a 🔊 tap nor entering practice mode hits a cold cache.
    [
      word.hanzi,
      stripPunctuation(word.hanzi),
      word.cn_definition,
      word.pairing_1,
      word.pairing_2,
      word.pairing_3,
      word.pairing_4,
      word.sentence_1,
      word.sentence_2,
    ]
      .filter((t): t is string => Boolean(t))
      .forEach(prefetchRevision);
  }, [word]);

  async function toggleFlag() {
    const next = !flagged;
    setFlagged(next);
    await touchMastery(childId, word.id, "write", { flagged: next });
  }

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
          <span className="text-5xl">🐣</span>
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

          <StrokeLadder
            key={`${word.id}-${charIndex}`}
            char={chars[charIndex]}
            announceWord={charIndex === 0 ? stripPunctuation(word.hanzi) : undefined}
            word={stripPunctuation(word.hanzi)}
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

        <div className="card p-6 flex flex-col gap-3" style={{ position: "relative" }}>
          <button
            type="button"
            onClick={toggleFlag}
            aria-label={flagged ? "Unmark as weak" : "Mark as weak"}
            title={flagged ? "Unmark as weak" : "Mark as weak"}
            className="inline-flex items-center gap-1"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              borderRadius: 999,
              padding: "5px 10px",
              border: `1.5px solid ${flagged ? "var(--warn)" : "var(--line)"}`,
              background: flagged ? "var(--warn-soft)" : "#fff",
              color: flagged ? "#8A6412" : "var(--mut)",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            ⚑ {flagged ? "Marked as weak" : "Mark as weak"}
          </button>

          <span
            className="text-sm font-semibold rounded-full px-3 py-1 self-start"
            style={{ background: "var(--accent-soft)", color: "var(--accent-d)" }}
          >
            识写
          </span>

          <div className="flex items-center gap-2">
            <h1 className="hanzi text-4xl font-extrabold">{word.hanzi}</h1>
            <SpeakButton text={word.hanzi} />
          </div>
          <p style={{ color: "var(--mut)" }}>{word.pinyin}</p>
          <p className="text-lg">{word.english}</p>

          {word.cn_definition && (
            <div className="flex items-center gap-2">
              <p style={{ color: "var(--mut)" }}>{word.cn_definition}</p>
              <SpeakButton text={word.cn_definition} />
            </div>
          )}

          {word.cn_definition && pairings.length > 0 && (
            <div aria-hidden style={{ borderTop: "1px solid var(--line)" }} />
          )}

          {pairings.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold" style={{ color: "var(--mut)" }}>
                搭配
              </p>
              <div className="flex flex-col gap-2">
                {pairings.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <p className="hanzi" style={{ lineHeight: 1.7 }}>
                      {p}
                    </p>
                    <SpeakButton text={p} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {pairings.length > 0 && (word.sentence_1 || word.sentence_2) && (
            <div aria-hidden style={{ borderTop: "1px solid var(--line)" }} />
          )}

          {(word.sentence_1 || word.sentence_2) && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold" style={{ color: "var(--mut)" }}>
                造句
              </p>
              <div className="flex flex-col gap-3">
                {[word.sentence_1, word.sentence_2].filter(Boolean).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <p className="hanzi" style={{ lineHeight: 1.7 }}>
                      {s}
                    </p>
                    <SpeakButton text={s as string} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setMode("practice")} className="btn btn-primary self-start">
          ▶ Start writing practice
        </button>
      </div>
    </main>
  );
}
