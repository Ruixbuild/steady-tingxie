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

  if (lists.length === 0) return null;

  if (lists.length === 1) {
    return (
      <span
        className="rounded-full border px-4 py-2 text-sm font-semibold"
        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
      >
        {lists[0].name}
      </span>
    );
  }

  return (
    <select
      value={selectedId}
      onChange={(e) => {
        const listId = e.target.value;
        // Remembered so the home page defaults to this list on the child's
        // next visit, instead of always falling back to the newest list.
        document.cookie = `lastList_${childId}=${listId}; path=/; max-age=${60 * 60 * 24 * 180}`;
        router.push(`/kid/${childId}?list=${listId}`);
      }}
      className="rounded-full border px-4 py-2 outline-none text-sm"
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
