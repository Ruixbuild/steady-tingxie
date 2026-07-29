"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { speak } from "@/lib/tts";
import { touchMastery } from "@/lib/revision/masteryActions";
import type { RevisionVocab } from "@/lib/revision/types";

function SpeakButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => speak(text)}
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

        <div className="card p-6 flex flex-col gap-3">
          <span
            className="text-sm font-semibold rounded-full px-3 py-1 self-start"
            style={{ background: "var(--accent-soft)", color: "var(--accent-d)" }}
          >
            识读
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

          {pairings.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold" style={{ color: "var(--mut)" }}>
                搭配
              </p>
              {pairings.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <p className="hanzi">{p}</p>
                  <SpeakButton text={p} />
                </div>
              ))}
            </div>
          )}

          {(word.sentence_1 || word.sentence_2) && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold" style={{ color: "var(--mut)" }}>
                造句
              </p>
              {[word.sentence_1, word.sentence_2].filter(Boolean).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <p className="hanzi">{s}</p>
                  <SpeakButton text={s as string} />
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleFlag}
          className="btn btn-sm btn-secondary self-start"
        >
          {flagged ? "✓ 已加强 · 取消标记" : "🚩 标记待加强"}
        </button>
      </div>
    </main>
  );
}
