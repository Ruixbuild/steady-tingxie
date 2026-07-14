"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { digitsToMarks, verdict } from "@/lib/pinyin";
import { speak } from "@/lib/tts";

type Props = {
  hanzi: string;
  answer: string;
  onDone: () => void;
};

export default function PinyinDrill({ hanzi, answer, onDone }: Props) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function liveTransform(raw: string) {
    const words = raw.split(" ");
    words[words.length - 1] = digitsToMarks(words[words.length - 1] ?? "");
    return words.join(" ");
  }

  function handleChange(raw: string) {
    const transformed = liveTransform(raw);
    setValue(transformed);
  }

  useEffect(() => {
    // typing is always at the end for this short single-answer field
    inputRef.current?.setSelectionRange(value.length, value.length);
  }, [value]);

  function check() {
    const result = verdict(value, answer);
    if (result === "exact") {
      setMessage({ text: "✓ Perfect pinyin!", ok: true });
      setTimeout(onDone, 900);
    } else if (result === "tones-wrong") {
      setMessage({ text: `Letters right — check the tones! It's ${answer}`, ok: true });
      setTimeout(onDone, 1400);
    } else {
      setMessage({ text: "Not quite — listen again and try 💪", ok: false });
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      check();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="hanzi text-4xl">{hanzi}</span>
        <button
          type="button"
          onClick={() => speak(hanzi)}
          className="btn btn-sm btn-secondary"
        >
          🔊 Listen
        </button>
      </div>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="type pinyin, e.g. ni3 hao3"
        className="rounded-full border px-5 py-3 outline-none"
        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {message && (
        <p className="text-sm" style={{ color: message.ok ? "var(--ok)" : "var(--miss)" }}>
          {message.text}
        </p>
      )}

      <button type="button" onClick={check} className="btn btn-primary">
        Check
      </button>
    </div>
  );
}
