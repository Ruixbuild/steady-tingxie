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
// recall it purely from sound. Shows a pass/fail verdict with the correct
// answer after each submit, then advances.
export default function TestPinyinInput({ hanzi, answer, onDone }: Props) {
  const [value, setValue] = useState("");
  const [done, setDone] = useState(false);
  const [passed, setPassed] = useState(false);
  const spokenRef = useRef(false);

  useEffect(() => {
    if (!spokenRef.current) {
      spokenRef.current = true;
      speak(hanzi);
    }
  }, [hanzi]);

  function finish(result: boolean) {
    setPassed(result);
    setDone(true);
    setTimeout(() => onDone({ passed: result }), 1200);
  }

  function submit() {
    finish(verdict(value, answer) === "exact");
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

      <button type="button" onClick={() => finish(false)} disabled={done} className="btn btn-secondary self-start">
        ✋ Skip
      </button>

      <PinyinToneInput onChange={setValue} onEnter={submit} disabled={done} />

      {done && (
        <p className="text-sm font-semibold" style={{ color: passed ? "#3E7A4E" : "#8A6412" }}>
          {passed ? "✓ Correct!" : `✗ Answer: ${answer}`}
        </p>
      )}

      <button type="button" onClick={submit} disabled={done} className="btn btn-primary">
        Next
      </button>
    </div>
  );
}
