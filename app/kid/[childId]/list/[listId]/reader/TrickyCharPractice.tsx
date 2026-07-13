"use client";

import { useRef, useState } from "react";
import CharLadder from "../learn/CharLadder";

// Pure practice, reusing the M3 Watch/Trace/Copy ladder on individual
// missed passage characters. No DB writes: passage characters have no
// per-position "level" slot to persist progress to (unlike a Learn item).
export default function TrickyCharPractice({
  chars,
  onDone,
}: {
  chars: string[];
  onDone: () => void;
}) {
  const epochRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  function handleCharDone() {
    if (index + 1 < chars.length) {
      setIndex((i) => i + 1);
    } else {
      setFinished(true);
    }
  }

  if (chars.length === 0 || finished) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <p className="font-semibold">Done — nice work!</p>
        <button type="button" onClick={onDone} className="btn btn-primary">
          Back to reader
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm" style={{ color: "var(--mut)" }}>
        Character {index + 1} / {chars.length}
      </p>
      <CharLadder
        key={index}
        char={chars[index]}
        skipWatch={false}
        epochRef={epochRef}
        onDone={handleCharDone}
      />
    </div>
  );
}
