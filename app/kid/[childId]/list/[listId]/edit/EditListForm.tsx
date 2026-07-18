"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EditableSectionInput, SectionKind } from "@/lib/supabase/types";

type ItemDraft = { id?: string; hanzi: string; pinyin: string; english: string };
export type EditableSectionDraft = {
  id?: string;
  kind: SectionKind;
  title: string;
  items: ItemDraft[];
};

const emptyItem = (): ItemDraft => ({ hanzi: "", pinyin: "", english: "" });
const emptySection = (kind: SectionKind = "words"): EditableSectionDraft => ({
  kind,
  title: "",
  items: [emptyItem()],
});

export default function EditListForm({
  childId,
  listId,
  initialName,
  initialTestDate,
  initialSections,
}: {
  childId: string;
  listId: string;
  initialName: string;
  initialTestDate: string;
  initialSections: EditableSectionDraft[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [testDate, setTestDate] = useState(initialTestDate);
  const [sections, setSections] = useState<EditableSectionDraft[]>(
    initialSections.length > 0 ? initialSections : [emptySection()]
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateSection(i: number, patch: Partial<EditableSectionDraft>) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function updateItem(sectionIdx: number, itemIdx: number, patch: Partial<ItemDraft>) {
    setSections((prev) =>
      prev.map((s, idx) =>
        idx !== sectionIdx
          ? s
          : { ...s, items: s.items.map((it, j) => (j === itemIdx ? { ...it, ...patch } : it)) }
      )
    );
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection()]);
  }

  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addItem(sectionIdx: number) {
    setSections((prev) =>
      prev.map((s, idx) => (idx === sectionIdx ? { ...s, items: [...s.items, emptyItem()] } : s))
    );
  }

  function removeItem(sectionIdx: number, itemIdx: number) {
    setSections((prev) =>
      prev.map((s, idx) =>
        idx === sectionIdx ? { ...s, items: s.items.filter((_, j) => j !== itemIdx) } : s
      )
    );
  }

  async function handleSubmit() {
    setError("");

    if (!name.trim()) {
      setError("Please enter a list name.");
      return;
    }

    const sectionsJson: EditableSectionInput[] = sections.map((s, sIdx) => ({
      id: s.id,
      kind: s.kind,
      title: s.title || undefined,
      ord: sIdx,
      items: s.items
        .filter((it) => it.hanzi.trim())
        .map((it, iIdx) => ({
          id: it.id,
          ord: iIdx,
          hanzi: it.hanzi.trim(),
          pinyin: it.pinyin.trim() || undefined,
          english: it.english.trim() || undefined,
        })),
    }));

    if (sectionsJson.every((s) => s.items.length === 0)) {
      setError("Add at least one word, pinyin item, or passage.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("update_list_tx", {
      list_id: listId,
      name: name.trim(),
      test_date: testDate || null,
      sections_json: sectionsJson,
    });

    if (rpcError) {
      setSaving(false);
      setError(rpcError.message);
      return;
    }

    router.push(`/kid/${childId}/list/${listId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="block mb-2 font-semibold" htmlFor="list-name">
          List name
        </label>
        <input
          id="list-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-full border px-5 py-3 outline-none"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        />
      </div>

      <div>
        <label className="block mb-2 font-semibold" htmlFor="test-date">
          Test date (optional)
        </label>
        <input
          id="test-date"
          type="date"
          value={testDate}
          onChange={(e) => setTestDate(e.target.value)}
          className="rounded-full border px-5 py-3 outline-none"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        />
      </div>

      {sections.map((section, sIdx) => (
        <div key={sIdx} className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(["words", "pinyin", "passage"] as SectionKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => updateSection(sIdx, { kind })}
                  className="btn btn-sm"
                  style={{
                    background: section.kind === kind ? "var(--accent)" : "#fff",
                    color: section.kind === kind ? "#fff" : "var(--accent)",
                    border: `1px solid ${section.kind === kind ? "var(--accent)" : "var(--line)"}`,
                  }}
                >
                  {kind}
                </button>
              ))}
            </div>
            {sections.length > 1 && (
              <button
                type="button"
                onClick={() => removeSection(sIdx)}
                className="text-sm"
                style={{ color: "var(--miss)" }}
              >
                Remove section
              </button>
            )}
          </div>

          <input
            placeholder="Section title (optional)"
            value={section.title}
            onChange={(e) => updateSection(sIdx, { title: e.target.value })}
            className="rounded-full border px-4 py-2 outline-none text-sm"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          />

          {section.kind === "passage" ? (
            <textarea
              placeholder="Full passage text, with punctuation"
              value={section.items[0]?.hanzi ?? ""}
              onChange={(e) => updateItem(sIdx, 0, { hanzi: e.target.value })}
              rows={4}
              className="hanzi rounded-2xl border px-4 py-3 outline-none"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {section.items.map((item, iIdx) => (
                <div key={iIdx} className="flex gap-2 items-center">
                  <input
                    placeholder="hanzi"
                    value={item.hanzi}
                    onChange={(e) => updateItem(sIdx, iIdx, { hanzi: e.target.value })}
                    className="hanzi rounded-full border px-4 py-2 outline-none text-sm w-24"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                  <input
                    placeholder="pinyin"
                    value={item.pinyin}
                    onChange={(e) => updateItem(sIdx, iIdx, { pinyin: e.target.value })}
                    className="rounded-full border px-4 py-2 outline-none text-sm w-28"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                  <input
                    placeholder="english (optional)"
                    value={item.english}
                    onChange={(e) => updateItem(sIdx, iIdx, { english: e.target.value })}
                    className="rounded-full border px-4 py-2 outline-none text-sm flex-1"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                  {section.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(sIdx, iIdx)}
                      style={{ color: "var(--miss)" }}
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addItem(sIdx)}
                className="text-sm text-left"
                style={{ color: "var(--accent)" }}
              >
                + Add row
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addSection}
        className="btn btn-sm btn-secondary self-start"
      >
        + Add section
      </button>

      {error && (
        <p className="text-sm" style={{ color: "var(--miss)" }}>
          {error}
        </p>
      )}

      <button type="button" onClick={handleSubmit} disabled={saving} className="btn btn-primary">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
