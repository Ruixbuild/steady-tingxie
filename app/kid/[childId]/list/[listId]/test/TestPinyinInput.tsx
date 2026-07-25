"use client";

import { useEffect, useRef, useState } from "react";
import { verdict } from "@/lib/pinyin";
import { announceOnEntry, replayItem } from "@/lib/narration";
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
      announceOnEntry("pinyin", "test", hanzi);
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
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => replayItem("pinyin", hanzi)}
          className="btn btn-sm btn-secondary"
        >
          🔊 Replay
        </button>
        <button type="button" onClick={() => finish(false)} disabled={done} className="btn btn-sm btn-secondary">
          ✋ Skip
        </button>
      </div>

      <PinyinToneInput onChange={setValue} onEnter={submit} disabled={done} />

      {done && (
        <p className="font-semibold" style={{ fontSize: "1.6rem", color: passed ? "#3E7A4E" : "#8A6412" }}>
          {passed ? "✓ Correct!" : `✗ Answer: ${answer}`}
        </p>
      )}

      <button type="button" onClick={submit} disabled={done} className="btn btn-primary mt-6">
        Next
      </button>
    </div>
  );
}
