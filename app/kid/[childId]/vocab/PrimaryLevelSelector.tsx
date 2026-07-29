"use client";

import { useRouter } from "next/navigation";

export default function PrimaryLevelSelector({
  childId,
  levels,
  selectedLevel,
}: {
  childId: string;
  levels: string[];
  selectedLevel: string;
}) {
  const router = useRouter();

  if (levels.length <= 1) return null;

  return (
    <select
      value={selectedLevel}
      onChange={(e) => {
        const level = e.target.value;
        // Remembered the same way ChapterSelector remembers its chapter --
        // switching level drops any chapter param, letting the landing
        // page's own fallback logic pick that level's first chapter.
        document.cookie = `lastPrimaryLevel_${childId}=${level}; path=/; max-age=${60 * 60 * 24 * 180}`;
        router.push(`/kid/${childId}/vocab?level=${level}`);
      }}
      className="rounded-full border px-4 py-2 outline-none text-sm"
      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
    >
      {levels.map((level) => (
        <option key={level} value={level}>
          {level}
        </option>
      ))}
    </select>
  );
}
