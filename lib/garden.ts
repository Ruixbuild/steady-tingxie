// Seasonal Garden extension — pure helpers shared by the /garden route.
// See tingxie-garden-extension.md. Term boundaries and the hash algorithm
// here must stay bit-for-bit in sync with garden_term_key/garden_tree_type
// in lib/supabase/garden_schema.sql (which is what actually decides a
// tree's term_key/tree_type at insert time) — this file only needs to
// reproduce term math for display (pill labels, fade-by-recency) and to
// derive stable, non-random scene layout from an item_id.

export type Term = 1 | 2 | 3 | 4;
export type TreeType = "pine" | "blossom" | "fruit";

export function getTerm(date: Date): Term {
  const md = (date.getMonth() + 1) * 100 + date.getDate(); // getMonth is 0-based; +1 -> Jan=1
  if (md >= 101 && md <= 315) return 1;
  if (md >= 316 && md <= 614) return 2;
  if (md >= 615 && md <= 910) return 3;
  return 4;
}

export function termKey(date: Date): string {
  return `${date.getFullYear()}-T${getTerm(date)}`;
}

const TERM_BOUNDS: Record<Term, [[number, number], [number, number]]> = {
  1: [[0, 1], [2, 15]], // Jan 1 - Mar 15 (month is 0-based)
  2: [[2, 16], [5, 14]], // Mar 16 - Jun 14
  3: [[5, 15], [8, 10]], // Jun 15 - Sep 10
  4: [[8, 11], [11, 31]], // Sep 11 - Dec 31
};

export function termBounds(key: string): { start: Date; end: Date } {
  const [yearStr, termStr] = key.split("-T");
  const year = Number(yearStr);
  const term = Number(termStr) as Term;
  const [[sm, sd], [em, ed]] = TERM_BOUNDS[term];
  return {
    start: new Date(year, sm, sd, 0, 0, 0),
    end: new Date(year, em, ed, 23, 59, 59, 999),
  };
}

// 32-bit unsigned multiply-add hash, matching the extension spec verbatim.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// 'blossom'/'fruit' render as a season-appropriate fruit rather than a
// fixed emoji — 🌸 is deliberately avoided since the existing per-list
// word garden (app/kid/[childId]/list/[listId]/progress) already uses it
// to mean "almost mastered" (level 2); reusing it here for a *fully grown*
// tree would contradict that meaning. 'pine' stays a constant evergreen
// (no seasonal read either way).
const SEASON_FRUIT: Record<Term, Record<Exclude<TreeType, "pine">, string>> = {
  1: { blossom: "🍓", fruit: "🍒" }, // spring: strawberry, cherry
  2: { blossom: "🍉", fruit: "🍑" }, // summer: watermelon, peach
  3: { blossom: "🍎", fruit: "🍐" }, // autumn: apple, pear
  4: { blossom: "🍊", fruit: "🍋" }, // winter: tangerine, lemon
};

export function treeEmoji(type: TreeType, term: Term): string {
  if (type === "pine") return "🌲";
  return SEASON_FRUIT[term][type];
}

export type TreeLayout = {
  leftPct: number;
  bottomPx: number;
  sizePx: number;
  rotationDeg: number;
};

const ROW_COUNT = 3;
const ROW_BOTTOM_PX = [8, 42, 76]; // invisible rows, bottom-to-top
const ROW_JITTER_PX = 10;

// Deterministic scatter, collision-free by construction: every item is
// dropped into one of a few invisible rows (hashed off its id, so it's
// stable across renders) and given its own horizontal slot within that
// row — sized to the row's item count — so trees never land on top of
// each other while still reading as "scattered" thanks to per-slot jitter.
export function treeLayouts(itemIds: string[]): Record<string, TreeLayout> {
  const sorted = [...itemIds].sort();
  const rows: string[][] = Array.from({ length: ROW_COUNT }, () => []);
  for (const itemId of sorted) {
    rows[hashString(itemId + ":row") % ROW_COUNT].push(itemId);
  }

  const layouts: Record<string, TreeLayout> = {};
  rows.forEach((rowItems, rowIdx) => {
    const slotWidth = 100 / rowItems.length;
    rowItems.forEach((itemId, slotIdx) => {
      const jitterRange = Math.max(1, Math.round(slotWidth * 0.3));
      const leftJitter = (hashString(itemId + ":left") % (jitterRange * 2 + 1)) - jitterRange;
      const leftPct = Math.min(
        96,
        Math.max(2, slotIdx * slotWidth + slotWidth / 2 + leftJitter)
      );
      const bottomJitter = (hashString(itemId + ":bottom") % (ROW_JITTER_PX * 2 + 1)) - ROW_JITTER_PX;
      const bottomPx = Math.max(4, ROW_BOTTOM_PX[rowIdx] + bottomJitter);
      const sizePx = 12 + (hashString(itemId + ":size") % 23); // 12-34px
      const rotationDeg = -6 + (hashString(itemId + ":rot") % 13); // -6..+6deg
      layouts[itemId] = { leftPct, bottomPx, sizePx, rotationDeg };
    });
  });
  return layouts;
}

export function fadeOpacity(grownAt: Date, key: string): number {
  const { start, end } = termBounds(key);
  const span = end.getTime() - start.getTime();
  if (span <= 0) return 1;
  const frac = (grownAt.getTime() - start.getTime()) / span;
  const clamped = Math.min(1, Math.max(0, frac));
  return 0.3 + 0.7 * clamped;
}

export type SeasonBackdrop = {
  sky: string;
  ground: string;
  ambient: string[];
  icon: string;
};

// Term number -> backdrop. Season names are visual theme only — never
// shown as UI text (labels always say "Term N"). `icon` is the single
// badge shown top-right of the scene as a season indicator; `ambient` are
// the scattered, non-interactive sky decorations.
export const SEASON_BACKDROP: Record<Term, SeasonBackdrop> = {
  1: {
    sky: "linear-gradient(180deg,#EAF3FB,#F7EEF5)",
    ground: "linear-gradient(180deg,#E4F3D6,#CFE7B4)",
    ambient: ["🌸", "☁️"],
    icon: "🌸",
  },
  2: {
    sky: "linear-gradient(180deg,#BFE3F7,#EAF6EE)",
    ground: "linear-gradient(180deg,#DFF0C4,#C3E297)",
    ambient: ["☀️", "☁️"],
    icon: "☀️",
  },
  3: {
    sky: "linear-gradient(180deg,#F5E4C8,#F2DCB9)",
    ground: "linear-gradient(180deg,#E8C48C,#D2A868)",
    ambient: ["🍂"],
    icon: "🍂",
  },
  4: {
    sky: "linear-gradient(180deg,#DCE7F0,#E9EEF2)",
    ground: "linear-gradient(180deg,#E4EEE7,#C9D9CD)",
    ambient: ["❄️"],
    icon: "❄️",
  },
};

export function termNumberFromKey(key: string): Term {
  return Number(key.split("-T")[1]) as Term;
}

export function previousTermKey(key: string): string {
  const [yearStr, termStr] = key.split("-T");
  const year = Number(yearStr);
  const term = Number(termStr) as Term;
  return term === 1 ? `${year - 1}-T4` : `${year}-T${term - 1}`;
}

// Mirrors garden_tree_type() in lib/supabase/garden_schema.sql — only used
// by the dev-only seed route (app/api/garden/seed/route.ts), since real
// tree_type values are decided server-side by that SQL function at insert
// time, not recomputed here.
export function treeType(itemId: string, key: string): TreeType {
  const hash = hashString(itemId + key);
  const types: TreeType[] = ["pine", "blossom", "fruit"];
  return types[hash % 3];
}
