"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { touchMastery } from "@/lib/revision/masteryActions";
import { prefetchRevision, speakRevision } from "@/lib/revision/narration";
import type { RevisionVocab } from "@/lib/revision/types";

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

export default function ReadCard({
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
  const [flagged, setFlagged] = useState(initialFlagged);

  useEffect(() => {
    touchMastery(childId, word.id, "read");
    // Fires once when the card is opened — recency/exposure tracking only,
    // not tied to the flag toggle below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);

  useEffect(() => {
    // Warms every speakable text on this card as soon as it's opened, so
    // the network round-trip to /api/tts is already done by the time a
    // child taps a 🔊 button — otherwise that tap is the first thing that
    // ever asks for this clip, and the fetch latency reads as a silent lag
    // before playback starts.
    [word.hanzi, word.cn_definition, word.pairing_1, word.pairing_2, word.pairing_3, word.pairing_4, word.sentence_1, word.sentence_2]
      .filter((t): t is string => Boolean(t))
      .forEach(prefetchRevision);
  }, [word]);

  async function toggleFlag() {
    const next = !flagged;
    setFlagged(next);
    await touchMastery(childId, word.id, "read", { flagged: next });
  }

  const pairings = [word.pairing_1, word.pairing_2, word.pairing_3, word.pairing_4].filter(
    (p): p is string => Boolean(p)
  );

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
            aria-label={flagged ? "Unmark as needing attention" : "Mark as needing attention"}
            title={flagged ? "Unmark as needing attention" : "Mark as needing attention"}
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
            ⚑ Attention
          </button>

          <span
            className="font-semibold rounded-full px-3 py-1 self-start"
            style={{ background: "var(--accent-soft)", color: "var(--accent-d)", fontSize: "clamp(0.875rem, 2.6vw, 1rem)" }}
          >
            识读
          </span>

          <div className="flex items-center gap-2">
            <h1 className="hanzi text-4xl font-extrabold">{word.hanzi}</h1>
            <SpeakButton text={word.hanzi} />
          </div>
          <p style={{ color: "var(--mut)", fontSize: "clamp(1rem, 3.2vw, 1.25rem)" }}>{word.pinyin}</p>
          <p style={{ fontSize: "clamp(1.125rem, 3.5vw, 1.375rem)" }}>{word.english}</p>

          {word.cn_definition && (
            <div className="flex items-center gap-2">
              <p style={{ color: "var(--mut)", fontSize: "clamp(1rem, 3.2vw, 1.25rem)" }}>{word.cn_definition}</p>
              <SpeakButton text={word.cn_definition} />
            </div>
          )}

          {word.cn_definition && pairings.length > 0 && (
            <div aria-hidden style={{ borderTop: "1px solid var(--line)" }} />
          )}

          {pairings.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-semibold" style={{ color: "var(--mut)", fontSize: "clamp(0.875rem, 2.6vw, 1rem)" }}>
                搭配
              </p>
              <div className="flex flex-col gap-2">
                {pairings.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <p className="hanzi" style={{ lineHeight: 1.7, fontSize: "clamp(1.15rem, 3.6vw, 1.4rem)" }}>
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
              <p className="font-semibold" style={{ color: "var(--mut)", fontSize: "clamp(0.875rem, 2.6vw, 1rem)" }}>
                造句
              </p>
              <div className="flex flex-col gap-3">
                {[word.sentence_1, word.sentence_2].filter(Boolean).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <p className="hanzi" style={{ lineHeight: 1.7, fontSize: "clamp(1.15rem, 3.6vw, 1.4rem)" }}>
                      {s}
                    </p>
                    <SpeakButton text={s as string} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
