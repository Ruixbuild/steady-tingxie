"use client";

import { useEffect, useRef, useState } from "react";
import { verdict } from "@/lib/pinyin";
import { speak } from "@/lib/tts";
import PinyinToneInput from "../PinyinToneInput";

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
  const spokenRef = useRef(false);

  useEffect(() => {
    if (!spokenRef.current) {
      spokenRef.current = true;
      speak(hanzi);
    }
  }, [hanzi]);

  function submit() {
    setDone(true);
    onDone({ passed: verdict(value, answer) === "exact" });
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => speak(hanzi)}
        className="btn btn-sm btn-secondary self-start"
      >
        🔊 Replay
      </button>

      <button type="button" onClick={() => onDone({ passed: false })} className="btn btn-secondary self-start">
        ✋ Skip
      </button>

      <PinyinToneInput onChange={setValue} onEnter={submit} disabled={done} />

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
