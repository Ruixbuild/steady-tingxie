"use client";

import type { SectionKind } from "@/lib/supabase/types";

export type ItemDraft = {
  hanzi: string;
  pinyin: string;
  english: string;
  confidence: number;
};

export type SectionDraft = {
  kind: SectionKind;
  title: string;
  items: ItemDraft[];
};

export const KIND_LABEL: Record<SectionKind, string> = {
  words: "words 词语",
  pinyin: "pinyin 拼音",
  passage: "dictation 默写",
};

export default function ReviewTable({
  sections,
  onChange,
}: {
  sections: SectionDraft[];
  onChange: (sections: SectionDraft[]) => void;
}) {
  function updateItem(sIdx: number, iIdx: number, patch: Partial<ItemDraft>) {
    const next = sections.map((s, i) =>
      i !== sIdx ? s : { ...s, items: s.items.map((it, j) => (j === iIdx ? { ...it, ...patch } : it)) }
    );
    onChange(next);
  }

  function removeItem(sIdx: number, iIdx: number) {
    const next = sections.map((s, i) =>
      i !== sIdx ? s : { ...s, items: s.items.filter((_, j) => j !== iIdx) }
    );
    onChange(next);
  }

  function addItem(sIdx: number) {
    const next = sections.map((s, i) =>
      i !== sIdx ? s : { ...s, items: [...s.items, { hanzi: "", pinyin: "", english: "", confidence: 1 }] }
    );
    onChange(next);
  }

  function updateSectionField(sIdx: number, patch: Partial<SectionDraft>) {
    const next = sections.map((s, i) => (i !== sIdx ? s : { ...s, ...patch }));
    onChange(next);
  }

  function moveItemKind(sIdx: number, iIdx: number, newKind: SectionKind) {
    const item = sections[sIdx].items[iIdx];
    let next = sections.map((s, i) =>
      i !== sIdx ? s : { ...s, items: s.items.filter((_, j) => j !== iIdx) }
    );
    const targetIdx = next.findIndex((s) => s.kind === newKind);
    if (targetIdx >= 0) {
      next = next.map((s, i) => (i === targetIdx ? { ...s, items: [...s.items, item] } : s));
    } else {
      next = [...next, { kind: newKind, title: KIND_LABEL[newKind], items: [item] }];
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section, sIdx) => {
        // low-confidence rows sorted to the top within their section
        const order = section.items
          .map((item, iIdx) => ({ item, iIdx }))
          .sort((a, b) => a.item.confidence - b.item.confidence);

        return (
          <div key={sIdx} className="card p-4 flex flex-col gap-3">
            <input
              value={section.title}
              onChange={(e) => updateSectionField(sIdx, { title: e.target.value })}
              placeholder={KIND_LABEL[section.kind]}
              className="rounded-full border px-4 py-2 outline-none text-sm"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />

            {order.map(({ item, iIdx }) => (
              <div key={iIdx} className="flex gap-2 items-center">
                <select
                  value={section.kind}
                  onChange={(e) => moveItemKind(sIdx, iIdx, e.target.value as SectionKind)}
                  className="rounded-full border px-2 py-2 outline-none text-xs"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                >
                  <option value="words">words 词语</option>
                  <option value="pinyin">pinyin 拼音</option>
                  <option value="passage">dictation 默写</option>
                </select>
                <input
                  value={item.hanzi}
                  onChange={(e) => updateItem(sIdx, iIdx, { hanzi: e.target.value })}
                  placeholder="汉字"
                  className="hanzi rounded-full border px-3 py-2 outline-none text-sm w-28"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                />
                {section.kind === "pinyin" && (
                  <input
                    value={item.pinyin}
                    onChange={(e) => updateItem(sIdx, iIdx, { pinyin: e.target.value })}
                    placeholder="pin1 yin1 or pīn yīn"
                    className="rounded-full border px-3 py-2 outline-none text-sm w-28"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                )}
                {item.confidence < 0.8 && (
                  <span className="chip" style={{ background: "var(--warn-soft)", color: "#8A6412" }}>
                    check
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(sIdx, iIdx)}
                  style={{ color: "var(--miss)" }}
                  aria-label="Remove row"
                >
                  ✕
                </button>
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
        );
      })}
    </div>
  );
}
