"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { downscaleImage } from "@/lib/imageDownscale";
import type { OcrResult } from "@/lib/ocrSchema";
import type { SectionKind } from "@/lib/supabase/types";
import ReviewTable, { KIND_LABEL, type ItemDraft, type SectionDraft } from "./ReviewTable";

export type ChildOption = {
  id: string;
  name: string;
  emoji: string;
  suggestedListName: string;
  suggestedTestDate: string;
};

const MAX_PHOTOS = 5;

function emptyItem(): ItemDraft {
  return { hanzi: "", pinyin: "", english: "", confidence: 1 };
}

function mergeSections(prev: SectionDraft[], incoming: OcrResult["sections"]): SectionDraft[] {
  const next = prev.map((s) => ({ ...s, items: [...s.items] }));
  for (const section of incoming) {
    const items: ItemDraft[] = section.items.map((it) => ({
      hanzi: it.hanzi,
      pinyin: it.pinyin ?? "",
      english: it.english ?? "",
      confidence: it.confidence ?? 1,
    }));
    const existing = next.find((s) => s.kind === section.kind);
    if (existing) {
      existing.items.push(...items);
    } else {
      next.push({
        kind: section.kind,
        title: section.title || KIND_LABEL[section.kind],
        items,
      });
    }
  }
  return next;
}

export default function UploadFlow({
  childOptions,
  sharedSections,
  sharedError,
}: {
  childOptions: ChildOption[];
  sharedSections?: OcrResult["sections"] | null;
  sharedError?: boolean;
}) {
  const router = useRouter();
  const hasShared = !!sharedSections && sharedSections.length > 0;
  const [stage, setStage] = useState<"intake" | "review" | "assign">(
    hasShared ? "review" : "intake"
  );
  const [sections, setSections] = useState<SectionDraft[]>(() =>
    hasShared ? mergeSections([], sharedSections!) : []
  );
  const [listName, setListName] = useState("");
  const [source, setSource] = useState<"ocr" | "manual">("ocr");
  const [photoCount, setPhotoCount] = useState(hasShared ? 1 : 0);
  const [processing, setProcessing] = useState(false);
  const [intakeError, setIntakeError] = useState(
    sharedError ? "Couldn't read the shared photo. Try again, or type it manually." : ""
  );
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [childId, setChildId] = useState(() => {
    if (typeof window === "undefined") return childOptions[0]?.id ?? "";
    return localStorage.getItem("lastUploadChildId") ?? childOptions[0]?.id ?? "";
  });
  const [testDate, setTestDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function processFiles(files: File[]) {
    const remaining = MAX_PHOTOS - photoCount;
    const toProcess = files.slice(0, remaining);
    if (toProcess.length === 0) {
      setIntakeError(`You can upload up to ${MAX_PHOTOS} photos per list.`);
      return;
    }

    setProcessing(true);
    setIntakeError("");

    for (const file of toProcess) {
      try {
        const { base64, mimeType } = await downscaleImage(file);
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        if (!res.ok) {
          setIntakeError(data.error ?? "Couldn't read that photo.");
          continue;
        }
        setSections((prev) => mergeSections(prev, (data as OcrResult).sections));
        setPhotoCount((n) => n + 1);
      } catch {
        setIntakeError("Couldn't read that photo. Check your connection and try again.");
      }
    }

    setProcessing(false);
    setStage((s) => (s === "intake" ? "review" : s));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processFiles(files);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) processFiles(files);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files: File[] = [];
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) processFiles(files);
  }

  function startManual() {
    setSource("manual");
    setSections([{ kind: "words" as SectionKind, title: KIND_LABEL.words, items: [emptyItem()] }]);
    setStage("review");
  }

  function proceedToAssign() {
    const child = childOptions.find((c) => c.id === childId);
    setListName(child?.suggestedListName ?? "");
    setTestDate(child?.suggestedTestDate ?? "");
    setStage("assign");
  }

  async function handleSave() {
    setSaveError("");
    if (!childId) {
      setSaveError("Please choose a child.");
      return;
    }
    if (!listName.trim()) {
      setSaveError("Please enter a list name.");
      return;
    }

    const sectionsJson = sections
      .map((s, sIdx) => ({
        kind: s.kind,
        title: s.title || undefined,
        ord: sIdx,
        items: s.items
          .filter((it) => it.hanzi.trim())
          .map((it, iIdx) => ({
            ord: iIdx,
            hanzi: it.hanzi.trim(),
            pinyin: it.pinyin.trim() || undefined,
            english: it.english.trim() || undefined,
            ocr_confidence: source === "ocr" ? it.confidence : undefined,
          })),
      }))
      .filter((s) => s.items.length > 0);

    if (sectionsJson.length === 0) {
      setSaveError("Add at least one word, pinyin item, or passage.");
      return;
    }

    setSaving(true);
    localStorage.setItem("lastUploadChildId", childId);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_list_tx", {
      child_id: childId,
      name: listName.trim(),
      test_date: testDate || null,
      source,
      sections_json: sectionsJson,
    });

    if (error) {
      setSaving(false);
      setSaveError(error.message);
      return;
    }

    router.push(`/kid/${childId}/list/${data}`);
  }

  if (stage === "intake") {
    return (
      <div className="flex flex-col gap-6">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onPaste={handlePaste}
          tabIndex={0}
          className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 p-10 text-center"
          style={{
            borderColor: dragActive ? "var(--accent)" : "var(--line)",
            background: dragActive ? "var(--accent-soft)" : "#fff",
          }}
        >
          <p style={{ color: "var(--mut)" }}>
            Drop / paste an image, or ({photoCount}/{MAX_PHOTOS} photos)
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={processing || photoCount >= MAX_PHOTOS}
              onClick={() => fileInputRef.current?.click()}
            >
              {processing ? "Reading…" : "Choose photo"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={startManual}>
              Type it manually
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {intakeError && (
          <p className="text-sm" style={{ color: "var(--miss)" }}>
            {intakeError}
          </p>
        )}

        {sections.length > 0 && (
          <button type="button" onClick={() => setStage("review")} className="btn btn-primary self-start">
            Review {photoCount} photo{photoCount === 1 ? "" : "s"} →
          </button>
        )}
      </div>
    );
  }

  if (stage === "review") {
    return (
      <div className="flex flex-col gap-6">
        <h3 className="font-semibold mb-1">2 · Enter / review the words</h3>
        <ReviewTable sections={sections} onChange={setSections} />
        <button type="button" onClick={proceedToAssign} className="btn btn-primary self-start">
          Assign →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block mb-2 font-semibold" htmlFor="assign-child">
          Child
        </label>
        <select
          id="assign-child"
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
          className="w-full rounded-full border px-5 py-3 outline-none"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          {childOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-2 font-semibold" htmlFor="assign-name">
          List name
        </label>
        <input
          id="assign-name"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          placeholder="e.g. 听写一"
          className="w-full rounded-full border px-5 py-3 outline-none"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        />
      </div>

      <div>
        <label className="block mb-2 font-semibold" htmlFor="assign-date">
          Test date (optional)
        </label>
        <input
          id="assign-date"
          type="date"
          value={testDate}
          onChange={(e) => setTestDate(e.target.value)}
          className="rounded-full border px-5 py-3 outline-none"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        />
      </div>

      {saveError && (
        <p className="text-sm" style={{ color: "var(--miss)" }}>
          {saveError}
        </p>
      )}

      <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
        {saving ? "Saving…" : "Save list"}
      </button>
    </div>
  );
}
