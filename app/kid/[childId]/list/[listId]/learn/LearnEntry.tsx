"use client";

import { useState } from "react";
import LearnSession, { type LearnItem } from "./LearnSession";
import TrickyPracticeIntro from "./TrickyPracticeIntro";

type TraceItem = { hanzi: string; traceSvg: string };

export default function LearnEntry({
  childId,
  listId,
  items,
  initialXp,
  traceItems,
}: {
  childId: string;
  listId: string;
  items: LearnItem[];
  initialXp: number;
  traceItems: TraceItem[];
}) {
  const [started, setStarted] = useState(traceItems.length === 0);

  if (!started) {
    return <TrickyPracticeIntro items={traceItems} onStart={() => setStarted(true)} />;
  }

  return <LearnSession childId={childId} listId={listId} items={items} initialXp={initialXp} />;
}
