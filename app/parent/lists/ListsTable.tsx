"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ListStatus, SectionKind } from "@/lib/supabase/types";
import { passageQuizPositions, predictedPct } from "@/lib/testScoring";

export type ListRow = {
  id: string;
  childId: string;
  childName: string;
  name: string;
  testDate: string | null;
  status: ListStatus;
  bestPct: number | null;
  predictedAtTest: number | null;
  actualScore: number | null;
  actualTotal: number | null;
};

type SectionRaw = {
  kind: SectionKind;
  items: { id: string; hanzi: string }[] | null;
};

async function computePredictedPct(childId: string, listId: string): Promise<number> {
  const supabase = createClient();
  const { data: sectionsRaw } = await supabase
    .from("sections")
    .select("kind, items(id, hanzi)")
    .eq("list_id", listId);
  const sections = (sectionsRaw ?? []) as unknown as SectionRaw[];

  const nonPassageItemIds: string[] = [];
  for (const s of sections) {
    if (s.kind === "passage") continue;
    for (const it of s.items ?? []) nonPassageItemIds.push(it.id);
  }

  const { data: masteryRows } =
    nonPassageItemIds.length > 0
      ? await supabase
          .from("mastery")
          .select("item_id, level")
          .eq("child_id", childId)
          .in("item_id", nonPassageItemIds)
      : { data: [] };
  const masteryByItem = new Map((masteryRows ?? []).map((m) => [m.item_id, m.level]));

  const nonPassageLevels: number[] = [];
  const passageCharMissed: boolean[] = [];
  for (const s of sections) {
    if (s.kind === "passage") {
      for (const it of s.items ?? []) {
        const { data: passMastery } = await supabase
          .from("mastery")
          .select("char_misses")
          .eq("child_id", childId)
          .eq("item_id", it.id)
          .maybeSingle();
        const misses = (passMastery?.char_misses ?? {}) as Record<string, number>;
        for (const pos of passageQuizPositions(it.hanzi)) {
          passageCharMissed.push((misses[String(pos)] ?? 0) > 0);
        }
      }
    } else {
      for (const it of s.items ?? []) {
        nonPassageLevels.push(masteryByItem.get(it.id) ?? 0);
      }
    }
  }

  return predictedPct({ nonPassageLevels, passageCharMissed });
}

export default function ListsTable({ lists }: { lists: ListRow[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState(lists);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDate, setDraftDate] = useState("");

  function flash(text: string) {
    setMessage(text);
    setTimeout(() => setMessage((m) => (m === text ? null : m)), 3000);
  }

  function startEdit(row: ListRow) {
    setEditingId(row.id);
    setDraftName(row.name);
    setDraftDate(row.testDate ?? "");
  }

  async function saveEdit(row: ListRow) {
    setBusyId(row.id);
    const { error } = await supabase
      .from("lists")
      .update({ name: draftName.trim() || row.name, test_date: draftDate || null })
      .eq("id", row.id);
    setBusyId(null);
    if (error) {
      flash(`Error: ${error.message}`);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, name: draftName.trim() || row.name, testDate: draftDate || null } : r
      )
    );
    setEditingId(null);
  }

  async function setStatus(row: ListRow, status: ListStatus) {
    setBusyId(row.id);
    const { error } = await supabase.from("lists").update({ status }).eq("id", row.id);
    setBusyId(null);
    if (error) {
      flash(`Error: ${error.message}`);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
  }

  async function deleteList(row: ListRow) {
    if (!window.confirm(`Delete "${row.name}"? This removes all its progress too.`)) return;
    setBusyId(row.id);
    const { error } = await supabase.from("lists").delete().eq("id", row.id);
    setBusyId(null);
    if (error) {
      flash(`Error: ${error.message}`);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  async function markTested(row: ListRow) {
    const scoreStr = window.prompt(`Actual score for "${row.name}" (correct answers)?`);
    if (scoreStr === null) return;
    const totalStr = window.prompt("Out of how many total?");
    if (totalStr === null) return;
    const actualScore = Number(scoreStr);
    const actualTotal = Number(totalStr);
    if (!Number.isFinite(actualScore) || !Number.isFinite(actualTotal) || actualTotal <= 0) {
      flash("Please enter valid numbers.");
      return;
    }

    setBusyId(row.id);
    const predictedPctNow = await computePredictedPct(row.childId, row.id);
    const { error } = await supabase.rpc("mark_list_tested", {
      list_id: row.id,
      predicted_pct: predictedPctNow,
      actual_score: actualScore,
      actual_total: actualTotal,
    });
    setBusyId(null);
    if (error) {
      flash(`Error: ${error.message}`);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: "tested",
              predictedAtTest: predictedPctNow,
              actualScore,
              actualTotal,
            }
          : r
      )
    );
    flash(`Marked "${row.name}" as tested.`);
  }

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <div className="toast" style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 70 }}>
          {message}
        </div>
      )}
      {rows.map((row) => (
          <div key={row.id} className="card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-sm" style={{ color: "var(--mut)" }}>
                  {row.childName}
                </span>
                {editingId === row.id ? (
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="rounded-full border px-3 py-1 outline-none text-sm"
                      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                    />
                    <input
                      type="date"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                      className="rounded-full border px-3 py-1 outline-none text-sm"
                      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => saveEdit(row)}
                      disabled={busyId === row.id}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="text-sm"
                      style={{ color: "var(--mut)" }}
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold">
                    {row.name}
                    <span className="text-sm ml-2" style={{ color: "var(--mut)" }}>
                      {row.testDate ?? "no test date"} · {row.status}
                    </span>
                  </h2>
                )}
              </div>
              {row.status === "tested" && row.predictedAtTest != null && (
                <span className="text-sm" style={{ color: "var(--mut)" }}>
                  Predicted ~{row.predictedAtTest}% · Actual {row.actualScore}/{row.actualTotal}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {editingId !== row.id && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => startEdit(row)}
                >
                  Rename / date
                </button>
              )}
              <Link
                href={`/kid/${row.childId}/list/${row.id}/edit`}
                className="btn btn-sm btn-secondary"
              >
                Reopen editor
              </Link>
              {row.status !== "archived" ? (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setStatus(row, "archived")}
                  disabled={busyId === row.id}
                >
                  Archive
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setStatus(row, "active")}
                  disabled={busyId === row.id}
                >
                  Restore
                </button>
              )}
              {row.status !== "tested" && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => markTested(row)}
                  disabled={busyId === row.id}
                >
                  Mark as tested
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ color: "var(--miss)" }}
                onClick={() => deleteList(row)}
                disabled={busyId === row.id}
              >
                Delete
              </button>
            </div>
          </div>
      ))}
    </div>
  );
}
