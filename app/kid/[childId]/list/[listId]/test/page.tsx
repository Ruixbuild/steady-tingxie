import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AttemptMode, SectionKind } from "@/lib/supabase/types";
import { isTricky, passageQuizPositions, predictedPct } from "@/lib/testScoring";
import TestPicker from "./TestPicker";
import TestSession, { type TestItem } from "./TestSession";

type SectionRaw = {
  kind: SectionKind;
  pick_n: number | null;
  items: { id: string; hanzi: string; pinyin: string | null }[] | null;
};

export default async function TestPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string; listId: string }>;
  searchParams: Promise<{ mode?: string; supervised?: string }>;
}) {
  const { childId, listId } = await params;
  const { mode, supervised } = await searchParams;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: child } = await supabase
    .from("children")
    .select("id, hard_mode")
    .eq("id", childId)
    .maybeSingle();
  if (!child) notFound();

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, best_pct")
    .eq("id", listId)
    .eq("child_id", childId)
    .maybeSingle();
  if (!list) notFound();

  const { data: sectionsRaw } = await supabase
    .from("sections")
    .select("kind, pick_n, items(id, hanzi, pinyin)")
    .eq("list_id", listId);
  const sections = sectionsRaw as unknown as SectionRaw[];

  const allItemIds: string[] = [];
  for (const s of sections ?? []) for (const it of s.items ?? []) allItemIds.push(it.id);

  const { data: masteryRows } =
    allItemIds.length > 0
      ? await supabase
          .from("mastery")
          .select("item_id, level, misses, char_misses")
          .eq("child_id", childId)
          .in("item_id", allItemIds)
      : { data: [] };

  const masteryByItem = new Map(
    (masteryRows ?? []).map((m) => [m.item_id, { level: m.level, misses: m.misses, char_misses: m.char_misses as Record<string, number> }])
  );

  // Predicted % for the picker's full-test guess.
  const nonPassageLevels: number[] = [];
  const passageCharMissed: boolean[] = [];
  for (const s of sections ?? []) {
    for (const it of s.items ?? []) {
      const m = masteryByItem.get(it.id);
      if (s.kind === "passage") {
        const positions = passageQuizPositions(it.hanzi);
        for (const pos of positions) {
          passageCharMissed.push((m?.char_misses?.[String(pos)] ?? 0) > 0);
        }
      } else {
        nonPassageLevels.push(m?.level ?? 0);
      }
    }
  }
  const predicted = predictedPct({ nonPassageLevels, passageCharMissed });

  if (!mode) {
    const counts = {
      words: 0,
      pinyin: 0,
      passage: 0,
      tricky: 0,
    };
    for (const s of sections ?? []) {
      const n = (s.items ?? []).length;
      if (s.kind === "words") counts.words += n;
      if (s.kind === "pinyin") counts.pinyin += n;
      if (s.kind === "passage") counts.passage += n;
    }
    for (const s of sections ?? []) {
      if (s.kind === "passage") continue;
      for (const it of s.items ?? []) {
        const m = masteryByItem.get(it.id);
        if (isTricky(s.kind, m?.level ?? 0, m?.misses ?? 0)) counts.tricky += 1;
      }
    }

    return (
      <TestPicker
        childId={childId}
        listId={listId}
        listName={list.name}
        predicted={predicted}
        counts={counts}
        supervised={supervised === "true"}
      />
    );
  }

  let testItems: TestItem[] = [];
  const requestedMode = mode as AttemptMode;

  for (const s of sections ?? []) {
    const kindMatches =
      requestedMode === "full" ||
      (requestedMode === "words" && s.kind === "words") ||
      (requestedMode === "pinyin" && s.kind === "pinyin") ||
      (requestedMode === "passage" && s.kind === "passage");

    if (kindMatches) {
      let items = (s.items ?? []).map((it) => ({ id: it.id, hanzi: it.hanzi, pinyin: it.pinyin, kind: s.kind as "words" | "pinyin" | "passage" }));
      if (s.kind === "pinyin" && s.pick_n && s.pick_n < items.length) {
        items = shuffle(items).slice(0, s.pick_n);
      }
      testItems = testItems.concat(items);
    }

    if (requestedMode === "tricky" && s.kind !== "passage") {
      for (const it of s.items ?? []) {
        const m = masteryByItem.get(it.id);
        if (isTricky(s.kind, m?.level ?? 0, m?.misses ?? 0)) {
          testItems.push({ id: it.id, hanzi: it.hanzi, pinyin: it.pinyin, kind: s.kind as "words" | "pinyin" });
        }
      }
    }
  }

  return (
    <TestSession
      childId={childId}
      listId={listId}
      mode={requestedMode}
      supervised={supervised === "true"}
      hardMode={child.hard_mode}
      guessPct={predicted}
      items={testItems}
    />
  );
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
