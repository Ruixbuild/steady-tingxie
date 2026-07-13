"use client";

import { useEffect, useRef, useState } from "react";
import { digitsToMarks, verdict } from "@/lib/pinyin";
import { speak } from "@/lib/tts";

type Props = {
  hanzi: string;
  answer: string;
  onDone: (result: { passed: boolean }) => void;
};

// Blind: the hanzi is spoken via TTS, never shown as text — child must
// recall it purely from sound. No exact/tones-wrong/wrong reveal here
// (that's Learn's job); Test only reports pass/fail, silently, per §7.3's
// "no mid-test verdicts" rule.
export default function TestPinyinInput({ hanzi, answer, onDone }: Props) {
  const [value, setValue] = useState("");
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const spokenRef = useRef(false);

  useEffect(() => {
    if (!spokenRef.current) {
      spokenRef.current = true;
      speak(hanzi);
    }
  }, [hanzi]);

  function liveTransform(raw: string) {
    const words = raw.split(" ");
    words[words.length - 1] = digitsToMarks(words[words.length - 1] ?? "");
    return words.join(" ");
  }

  useEffect(() => {
    inputRef.current?.setSelectionRange(value.length, value.length);
  }, [value]);

  function submit() {
    setDone(true);
    onDone({ passed: verdict(value, answer) === "exact" });
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => speak(hanzi)}
        className="btn btn-secondary self-start"
        style={{ minHeight: 40, padding: "0 16px" }}
      >
        🔊 Replay
      </button>

      <button type="button" onClick={() => onDone({ passed: false })} className="btn btn-secondary self-start">
        ✋ Skip
      </button>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(liveTransform(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="type pinyin"
        className="rounded-full border px-5 py-3 outline-none"
        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={done}
      />

      {done && (
        <p className="text-sm" style={{ color: "var(--mut)" }}>
          Done ✔ — next one…
        </p>
      )}

      <button type="button" onClick={submit} disabled={done} className="btn btn-primary">
        Next
      </button>
    </div>
  );
}
