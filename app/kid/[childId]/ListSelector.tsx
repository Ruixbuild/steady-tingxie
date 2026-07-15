"use client";

import { useRouter } from "next/navigation";

export default function ListSelector({
  childId,
  lists,
  selectedId,
}: {
  childId: string;
  lists: { id: string; name: string }[];
  selectedId: string;
}) {
  const router = useRouter();

  if (lists.length <= 1) return null;

  return (
    <select
      value={selectedId}
      onChange={(e) => router.push(`/kid/${childId}?list=${e.target.value}`)}
      className="rounded-full border px-4 py-2 outline-none text-sm mb-4"
      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
    >
      {lists.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
