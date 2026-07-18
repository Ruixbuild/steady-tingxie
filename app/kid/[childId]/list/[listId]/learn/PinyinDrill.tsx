"use client";

import { useState } from "react";
import { toMarks, verdict } from "@/lib/pinyin";
import { speak } from "@/lib/tts";
import PinyinToneInput from "../PinyinToneInput";

type Props = {
  hanzi: string;
  answer: string;
  onDone: () => void;
};

export default function PinyinDrill({ hanzi, answer, onDone }: Props) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function check() {
    const result = verdict(value, answer);
    if (result === "exact") {
      setMessage({ text: "✓ Perfect pinyin!", ok: true });
    } else if (result === "tones-wrong") {
      setMessage({ text: `Letters right — check the tones! It's ${toMarks(answer)}`, ok: true });
    } else {
      setMessage({ text: "Not quite — listen again and try 💪", ok: false });
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

      <PinyinToneInput onChange={setValue} onEnter={check} />

      {message && (
        <p className="text-lg font-semibold" style={{ color: message.ok ? "var(--ok)" : "var(--miss)" }}>
          {message.text}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={check} className="btn btn-primary">
          Check
        </button>
        {message?.ok && (
          <button type="button" onClick={onDone} className="btn btn-primary">
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
