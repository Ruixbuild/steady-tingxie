"use client";

import { useActionState, useState } from "react";
import { addChild } from "./actions";
import type { Level } from "@/lib/supabase/types";

const LEVELS: Level[] = ["P1", "P2", "P3", "P4", "P5", "P6"];

const EMOJIS = [
  "🙂", "😀", "🐨", "🐼", "🦊", "🐱",
  "🐶", "🦁", "🐸", "🐵", "🦄", "🐧",
];

export default function OnboardingForm() {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) =>
      addChild(formData),
    undefined
  );
  const [level, setLevel] = useState<Level>("P1");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [higherChinese, setHigherChinese] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="emoji" value={emoji} />
      <input type="hidden" name="higherChinese" value={higherChinese ? "true" : "false"} />

      <div>
        <label className="block mb-2 font-semibold" htmlFor="name">
          Child&apos;s name
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="e.g. Wei Ling"
          className="w-full rounded-full border px-5 py-3 outline-none"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        />
      </div>

      <div>
        <span className="block mb-2 font-semibold">Level</span>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              type="button"
              key={l}
              onClick={() => setLevel(l)}
              className="btn btn-sm"
              style={{
                background: level === l ? "var(--accent)" : "#fff",
                color: level === l ? "#fff" : "var(--accent)",
                border: `1px solid ${level === l ? "var(--accent)" : "var(--line)"}`,
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block mb-2 font-semibold">Pick an emoji</span>
        <div className="grid grid-cols-4 gap-3">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => setEmoji(e)}
              className="flex items-center justify-center text-2xl rounded-2xl aspect-square"
              style={{
                background: emoji === e ? "var(--accent-soft)" : "#fff",
                border: `1.5px solid ${emoji === e ? "var(--accent)" : "var(--line)"}`,
              }}
              aria-label={`emoji ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block mb-2 font-semibold">Higher Chinese (HCI)</span>
        <p className="text-sm mb-2" style={{ color: "var(--mut)" }}>
          Adds the extra Higher Chinese word set to Vocabulary Revision for this child.
        </p>
        <button
          type="button"
          onClick={() => setHigherChinese((v) => !v)}
          className="btn btn-sm"
          style={{
            background: higherChinese ? "var(--accent)" : "#fff",
            color: higherChinese ? "#fff" : "var(--accent)",
            border: `1px solid ${higherChinese ? "var(--accent)" : "var(--line)"}`,
          }}
        >
          {higherChinese ? "On" : "Off"}
        </button>
      </div>

      {state?.error && (
        <p className="text-sm" style={{ color: "var(--miss)" }}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
