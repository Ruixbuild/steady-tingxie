"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Level } from "@/lib/supabase/types";

const LEVEL_ORDER: Level[] = ["P1", "P2", "P3", "P4", "P5", "P6"];
function atLeastP3(level: Level) {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf("P3");
}

type ChildOption = { id: string; name: string; level: Level; hardMode: boolean };

export default function SettingsForm({
  digestEmail,
  childOptions,
}: {
  digestEmail: boolean;
  childOptions: ChildOption[];
}) {
  const supabase = createClient();
  const [digest, setDigest] = useState(digestEmail);
  const [children, setChildren] = useState(childOptions);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function toggleDigest() {
    const next = !digest;
    setDigest(next);
    setSavingKey("digest");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ digest_email: next }).eq("id", user.id);
    }
    setSavingKey(null);
  }

  async function toggleHardMode(childId: string) {
    const child = children.find((c) => c.id === childId);
    if (!child) return;
    const next = !child.hardMode;
    setChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, hardMode: next } : c)));
    setSavingKey(childId);
    await supabase.from("children").update({ hard_mode: next }).eq("id", childId);
    setSavingKey(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5 flex items-center justify-between">
        <div>
          <p className="font-semibold">Weekly email digest</p>
          <p className="text-sm" style={{ color: "var(--mut)" }}>
            A short Sunday-evening summary of each child&apos;s progress.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleDigest}
          disabled={savingKey === "digest"}
          className="btn"
          style={{
            minHeight: 36,
            padding: "0 16px",
            background: digest ? "var(--accent)" : "#fff",
            color: digest ? "#fff" : "var(--accent)",
            border: `1px solid ${digest ? "var(--accent)" : "var(--line)"}`,
          }}
        >
          {digest ? "On" : "Off"}
        </button>
      </div>

      {children.filter((c) => atLeastP3(c.level)).length > 0 && (
        <div className="card p-5 flex flex-col gap-3">
          <p className="font-semibold">Hard mode</p>
          <p className="text-sm" style={{ color: "var(--mut)" }}>
            Stricter stroke-mistake tolerance, available from P3 onward.
          </p>
          {children
            .filter((c) => atLeastP3(c.level))
            .map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <span>
                  {c.name} <span style={{ color: "var(--mut)" }}>({c.level})</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleHardMode(c.id)}
                  disabled={savingKey === c.id}
                  className="btn"
                  style={{
                    minHeight: 32,
                    padding: "0 14px",
                    background: c.hardMode ? "var(--accent)" : "#fff",
                    color: c.hardMode ? "#fff" : "var(--accent)",
                    border: `1px solid ${c.hardMode ? "var(--accent)" : "var(--line)"}`,
                  }}
                >
                  {c.hardMode ? "On" : "Off"}
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
