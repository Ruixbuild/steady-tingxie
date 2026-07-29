"use client";

import { useRouter } from "next/navigation";

export default function ChapterSelector({
  childId,
  chapters,
  selectedNumber,
}: {
  childId: string;
  chapters: { number: number; title: string }[];
  selectedNumber: number;
}) {
  const router = useRouter();

  if (chapters.length <= 1) return null;

  return (
    <select
      value={selectedNumber}
      onChange={(e) => {
        const chapterNumber = e.target.value;
        // Remembered so the landing page defaults to this chapter on the
        // child's next visit, same pattern as ListSelector's lastList_ cookie.
        document.cookie = `lastChapter_${childId}=${chapterNumber}; path=/; max-age=${60 * 60 * 24 * 180}`;
        router.push(`/kid/${childId}/vocab?chapter=${chapterNumber}`);
      }}
      className="rounded-full border px-4 py-2 outline-none text-sm"
      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
    >
      {chapters.map((c) => (
        <option key={c.number} value={c.number}>
          {c.title}
        </option>
      ))}
    </select>
  );
}
