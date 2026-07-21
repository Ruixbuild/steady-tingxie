"use client";

import { useMemo, useState } from "react";
import {
  fadeOpacity,
  treeEmoji,
  treeLayouts,
  type SeasonBackdrop,
  type TreeType,
} from "@/lib/garden";

export type GardenTreeItem = {
  id: string;
  itemId: string;
  hanzi: string;
  type: TreeType;
  grownAt: string;
};

export default function GardenScene({
  termKey,
  backdrop,
  items,
}: {
  termKey: string;
  backdrop: SeasonBackdrop;
  items: GardenTreeItem[];
}) {
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);

  const mostRecentId = useMemo(() => {
    if (items.length === 0) return null;
    return items.reduce((latest, it) =>
      new Date(it.grownAt) > new Date(latest.grownAt) ? it : latest
    ).id;
  }, [items]);

  const activeTree = items.find((it) => it.id === activeTreeId) ?? null;

  const layoutByItemId = useMemo(
    () => treeLayouts(items.map((it) => it.itemId)),
    [items]
  );

  return (
    <div
      className="card relative overflow-hidden"
      style={{ height: 240, borderRadius: 18 }}
      onClick={() => setActiveTreeId(null)}
    >
      <div
        className="absolute inset-0"
        style={{ background: backdrop.sky }}
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: "52%", background: backdrop.ground }}
      />

      {backdrop.ambient.map((emoji, i) => (
        <span
          key={i}
          className="absolute select-none"
          style={{
            top: 10 + i * 14,
            left: `${15 + i * 30}%`,
            fontSize: 20,
            opacity: 0.35,
          }}
        >
          {emoji}
        </span>
      ))}

      <span
        className="absolute select-none"
        style={{ top: 10, right: 12, fontSize: 26, opacity: 0.9 }}
        aria-hidden
      >
        {backdrop.icon}
      </span>

      {items.map((item) => {
        const layout = layoutByItemId[item.itemId];
        if (!layout) return null;
        const opacity = fadeOpacity(new Date(item.grownAt), termKey);
        const glow = item.id === mostRecentId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTreeId((cur) => (cur === item.id ? null : item.id));
            }}
            className="absolute select-none"
            style={{
              left: `${layout.leftPct}%`,
              bottom: layout.bottomPx,
              fontSize: layout.sizePx,
              transform: `rotate(${layout.rotationDeg}deg)`,
              opacity,
              filter: glow ? "drop-shadow(0 0 4px var(--warn))" : undefined,
              background: "none",
              border: "none",
              padding: 0,
              lineHeight: 1,
              cursor: "pointer",
            }}
            aria-label={item.hanzi}
          >
            {treeEmoji(item.type)}
          </button>
        );
      })}

      {activeTree && (
        <div
          className="absolute left-1/2 bottom-3 -translate-x-1/2 px-5 py-2"
          style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            border: "1px solid rgba(255,255,255,0.7)",
            borderRadius: 14,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="hanzi text-2xl">{activeTree.hanzi}</span>
        </div>
      )}
    </div>
  );
}
