// Seasonal Garden extension — pure helpers shared by the /garden route.
// See tingxie-garden-extension.md. Term boundaries here must stay in sync
// with garden_term_key() in lib/supabase/garden_schema.sql (which is what
// actually decides a tree's term_key at insert time) — this file only
// needs to reproduce term math for display (pill labels, fade-by-recency)
// and to derive stable, non-random scene layout from an item_id.

import type { Level, SectionKind } from "@/lib/supabase/types";

export type Term = 1 | 2 | 3 | 4;

// A tree's species is a difficulty tier, not a random pick: 'tree' = an
// easy/short word for the child's grade band, 'fruit' = a longer word or
// passage — more reward for the harder practice.
export type TreeType = "tree" | "fruit";

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

// Mirrors garden_tier() in lib/supabase/garden_tier_migration.sql
// bit-for-bit — this is what decides a tree's real tree_type server-side;
// this copy is only for the dev-only seed route to fabricate realistic
// data (app/api/garden/seed/route.ts).
//   P1-P3: tree = 1-2 char 词语 or any pinyin item; fruit = longer 词语 or 默写
//   P4-P6: tree = up to 4 char 词语 or any pinyin item; fruit = longer 词语 or 默写
export function gardenTier(level: Level, kind: SectionKind, hanzi: string): TreeType {
  const grade = Number(level.slice(1)) || 6;
  const threshold = grade <= 3 ? 2 : 4;
  if (kind === "passage") return "fruit";
  if (kind === "pinyin") return "tree";
  if (kind === "words" && hanzi.length > threshold) return "fruit";
  return "tree";
}

// Candidate emoji per tier — 'fruit' varies by season (more reward for the
// harder tier), 'tree' stays a plain, season-agnostic pair. 🌸 is
// deliberately avoided: the existing per-list word garden (app/kid/
// [childId]/list/[listId]/progress) already uses it to mean "almost
// mastered" (level 2), so reusing it for a *fully grown* tree would
// contradict that meaning. Which candidate renders is picked
// deterministically per item, purely for scatter variety.
const TREE_CANDIDATES = ["🌳", "🌲"];
// Exported so callers that want a single representative "this season's
// fruit" icon (e.g. the garden tips card) don't have to duplicate this
// table — pick SEASON_FRUIT[term][0].
export const SEASON_FRUIT: Record<Term, string[]> = {
  1: ["🍓", "🍒"], // spring: strawberry, cherry
  2: ["🍉", "🍑"], // summer: watermelon, peach
  3: ["🍎", "🍐"], // autumn: apple, pear
  4: ["🍊", "🍋"], // winter: tangerine, lemon
};

export function treeEmoji(type: TreeType, term: Term, itemId: string): string {
  const candidates = type === "tree" ? TREE_CANDIDATES : SEASON_FRUIT[term];
  return candidates[hashString(itemId + ":species") % candidates.length];
}

export type TreeLayout = {
  leftPct: number;
  bottomPx: number;
  sizePx: number;
};

// Icons render upright (no rotation) and rows sit at a fixed height (no
// per-item vertical jitter) — a prior version scattered both, which read as
// "slanted"/messy once a term had more than a handful of trees. Row count
// now grows with the item count instead of staying fixed at 3, so a busy
// term doesn't cram many items into one row's worth of horizontal space.
const MAX_ICON_PX = 32; // sizePx's own max (22 + 10) below
const MAX_PER_ROW = 5;
const ROW_SPACING_PX = 40; // > MAX_ICON_PX, so stacked rows never touch vertically
const BASE_BOTTOM_PX = 10;
const GROUND_TOP_MARGIN_PX = 16; // breathing room above the topmost row
export const GROUND_FRACTION = 0.52; // must match GardenScene's ground <div> height
export const SCENE_MIN_HEIGHT_PX = 240;

export function gardenRowCount(itemCount: number): number {
  return Math.max(3, Math.ceil(itemCount / MAX_PER_ROW));
}

// The scene's fixed height used to be a flat 240px regardless of how many
// trees it held — fine for 3 rows, but a busy term's extra rows had
// nowhere to go within that ground strip and started overlapping the sky.
// Grows the scene (via GardenScene's height prop) to fit however many rows
// gardenRowCount produces.
export function gardenSceneHeightPx(itemCount: number): number {
  const rows = gardenRowCount(itemCount);
  const neededGroundPx =
    BASE_BOTTOM_PX + (rows - 1) * ROW_SPACING_PX + MAX_ICON_PX + GROUND_TOP_MARGIN_PX;
  return Math.max(SCENE_MIN_HEIGHT_PX, Math.ceil(neededGroundPx / GROUND_FRACTION));
}

// Deterministic scatter, collision-free by construction: every item gets a
// row and a horizontal slot within that row, sized to the row's item
// count, so trees never land on top of each other.
export function treeLayouts(
  items: { itemId: string; type: TreeType }[]
): Record<string, TreeLayout> {
  const rowCount = gardenRowCount(items.length);
  const sorted = items.map((it) => it.itemId).sort();
  // Round-robin over the sorted ids, not a per-id hash into a row —
  // hashing let rows land unevenly by chance (most items could hash into
  // the same row), packing that row's slots too tight for its icon size
  // and overlapping. Round-robin guarantees every row's count differs by
  // at most 1, while staying stable across renders since the input order
  // is already sorted rather than incidental.
  const rows: string[][] = Array.from({ length: rowCount }, () => []);
  sorted.forEach((itemId, i) => rows[i % rowCount].push(itemId));

  const layouts: Record<string, TreeLayout> = {};
  rows.forEach((rowItems, rowIdx) => {
    const slotWidth = 100 / rowItems.length;
    // Jitter capped conservatively: two full-size icons in adjacent slots,
    // both jittered toward each other at once, must still clear each
    // other's width even on a narrow phone screen. A wider fraction (tried
    // during the original design) let that worst case overlap.
    const jitterRange = Math.min(2, Math.max(1, Math.round(slotWidth * 0.12)));
    rowItems.forEach((itemId, slotIdx) => {
      const leftJitter = (hashString(itemId + ":left") % (jitterRange * 2 + 1)) - jitterRange;
      // Position is anchored by the icon's left edge, not centered, and the
      // scene clips overflow — so the right-side margin has to leave room
      // for the icon's own width (up to 32px), not just a thin percentage.
      const leftPct = Math.min(
        88,
        Math.max(8, slotIdx * slotWidth + slotWidth / 2 + leftJitter)
      );
      const bottomPx = BASE_BOTTOM_PX + rowIdx * ROW_SPACING_PX;
      // Tightened from a 16-40px range — that much size variance between
      // neighboring icons was reading as visual noise, not organic growth.
      const sizePx = 22 + (hashString(itemId + ":size") % 11); // 22-32px
      layouts[itemId] = { leftPct, bottomPx, sizePx };
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

// Season names shown as UI text here — distinct from SEASON_BACKDROP's
// `icon`/`ambient`, which are visual-only and never surfaced as text.
export const SEASON_NAME: Record<Term, string> = {
  1: "Spring",
  2: "Summer",
  3: "Autumn",
  4: "Winter",
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
