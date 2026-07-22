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
  childOptions,
}: {
  childOptions: ChildOption[];
}) {
  const supabase = createClient();
  const [children, setChildren] = useState(childOptions);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  async function saveName(childId: string) {
    const child = children.find((c) => c.id === childId);
    const draft = nameDrafts[childId]?.trim();
    if (!child || !draft || draft === child.name) return;
    setChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, name: draft } : c)));
    setNameDrafts((prev) => {
      const next = { ...prev };
      delete next[childId];
      return next;
    });
    setSavingKey(`name:${childId}`);
    await supabase.from("children").update({ name: draft }).eq("id", childId);
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
      <div className="card p-5 flex flex-col gap-3">
        <p className="font-semibold">Child profiles</p>
        {children.map((c) => {
          const draft = nameDrafts[c.id] ?? c.name;
          const dirty = draft.trim().length > 0 && draft.trim() !== c.name;
          return (
            <div key={c.id} className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) =>
                  setNameDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                }
                className="flex-1"
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                }}
              />
              <span style={{ color: "var(--mut)" }}>({c.level})</span>
              {dirty && (
                <button
                  type="button"
                  onClick={() => saveName(c.id)}
                  disabled={savingKey === `name:${c.id}`}
                  className="btn btn-sm btn-primary"
                >
                  Save
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="card p-5 flex items-center justify-between">
        <div>
          <p className="font-semibold">Weekly email digest</p>
          <p className="text-sm" style={{ color: "var(--mut)" }}>
            A short Sunday-evening summary of each child&apos;s progress. Coming soon.
          </p>
        </div>
        <span
          className="btn btn-sm"
          style={{
            background: "#fff",
            color: "var(--mut)",
            border: "1px solid var(--line)",
            cursor: "default",
          }}
        >
          Off
        </span>
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
                  className="btn btn-sm"
                  style={{
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
