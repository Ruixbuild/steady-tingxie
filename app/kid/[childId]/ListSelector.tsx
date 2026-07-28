"use client";

import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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

  const selected = lists.find((l) => l.id === selectedId);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="picker-trigger"
      >
        <span>{selected ? selected.name : "Choose list"}</span>
        <span style={{ color: "var(--mut)", fontSize: "0.8rem" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          className="picker-menu"
          style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 220, zIndex: 10 }}
        >
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                // Remembered so the home page defaults to this list on the
                // child's next visit, instead of always falling back to the
                // newest list.
                document.cookie = `lastList_${childId}=${l.id}; path=/; max-age=${60 * 60 * 24 * 180}`;
                setOpen(false);
                router.push(`/kid/${childId}?list=${l.id}`);
              }}
              data-selected={l.id === selectedId}
              className="picker-option"
            >
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
