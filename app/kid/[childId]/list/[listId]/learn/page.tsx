import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AttemptMode, SectionKind } from "@/lib/supabase/types";
import { isTricky, passageQuizPositions } from "@/lib/testScoring";
import LearnEntry from "./LearnEntry";
import LearnPicker from "./LearnPicker";
import type { LearnItem } from "./LearnSession";

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string; listId: string }>;
  searchParams: Promise<{ items?: string; fromTest?: string; mode?: string }>;
}) {
  const { childId, listId } = await params;
  const { items: itemsParam, fromTest, mode } = await searchParams;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: child } = await supabase
    .from("children")
    .select("id, xp")
    .eq("id", childId)
    .maybeSingle();

  if (!child) {
    notFound();
  }

  const { data: list } = await supabase
    .from("lists")
    .select("id, name")
    .eq("id", listId)
    .eq("child_id", childId)
    .maybeSingle();

  if (!list) {
    notFound();
  }

  const { data: sectionsRaw } = await supabase
    .from("sections")
    .select("id, kind, ord, items(id, ord, hanzi, pinyin)")
    .eq("list_id", listId)
    .order("ord");

  const sections = sectionsRaw as unknown as {
    kind: SectionKind;
    items: { id: string; ord: number; hanzi: string; pinyin: string | null }[] | null;
  }[];

  const allItemIds = (sections ?? []).flatMap((s) => (s.items ?? []).map((it) => it.id));
  const { data: masteryRows } =
    allItemIds.length > 0
      ? await supabase
          .from("mastery")
          .select("item_id, level, misses, char_misses")
          .eq("child_id", childId)
          .in("item_id", allItemIds)
      : { data: [] };
  const masteryByItem = new Map(
    (masteryRows ?? []).map((m) => [
      m.item_id,
      { level: m.level, misses: m.misses, char_misses: m.char_misses as Record<string, number> },
    ])
  );

  let allItems: LearnItem[] = [];
  for (const section of sections ?? []) {
    const kind = section.kind as "words" | "pinyin" | "passage";
    const sectionItems = (section.items ?? [])
      .slice()
      .sort((a, b) => a.ord - b.ord)
      .map((it) => ({
        id: it.id,
        hanzi: it.hanzi,
        pinyin: it.pinyin,
        kind,
        charMisses:
          kind === "passage" || kind === "words" ? masteryByItem.get(it.id)?.char_misses : undefined,
      }));
    allItems = allItems.concat(sectionItems);
  }

  // No explicit item list and no mode chosen yet — offer the same
  // full/words/pinyin/passage/tricky picker Test uses, rather than
  // silently starting a full-list practice session. Bypassed whenever a
  // caller already knows which items it wants (ChildHomeHero's daily CTA,
  // the garden's tricky-word link, a post-test flip retry) — those always
  // pass `items=`.
  if (!itemsParam && !mode) {
    const counts = { words: 0, pinyin: 0, passage: 0, tricky: 0 };
    for (const it of allItems) {
      counts[it.kind] += 1;
      const m = masteryByItem.get(it.id);
      if (it.kind === "passage") {
        const positions = passageQuizPositions(it.hanzi);
        if (positions.some((pos) => (m?.char_misses?.[String(pos)] ?? 0) > 0)) counts.tricky += 1;
      } else if (isTricky(it.kind, m?.level ?? 0, m?.misses ?? 0)) {
        counts.tricky += 1;
      }
    }

    return (
      <LearnPicker childId={childId} listId={listId} listName={list.name} counts={counts} />
    );
  }

  let learnItems = allItems;
  if (mode) {
    const requestedMode = mode as AttemptMode;
    learnItems =
      requestedMode === "tricky"
        ? allItems.filter((it) => {
            const m = masteryByItem.get(it.id);
            if (it.kind === "passage") {
              const positions = passageQuizPositions(it.hanzi);
              return positions.some((pos) => (m?.char_misses?.[String(pos)] ?? 0) > 0);
            }
            return isTricky(it.kind, m?.level ?? 0, m?.misses ?? 0);
          })
        : allItems.filter((it) => requestedMode === "full" || it.kind === requestedMode);
  } else if (itemsParam) {
    const requestedIds = new Set(itemsParam.split(",").filter(Boolean));
    // Re-validate against this list's own items — RLS already stops cross-child
    // access, but a hand-edited URL could otherwise reference a valid item
    // from a *different* list the same child owns.
    learnItems = allItems.filter((it) => requestedIds.has(it.id));
  }

  let traceItems: { hanzi: string; traceSvg: string }[] = [];
  if (fromTest === "1" && learnItems.length > 0) {
    const { data: traceMasteryRows } = await supabase
      .from("mastery")
      .select("item_id, last_trace_svg")
      .eq("child_id", childId)
      .in(
        "item_id",
        learnItems.map((it) => it.id)
      );
    const svgByItem = new Map((traceMasteryRows ?? []).map((m) => [m.item_id, m.last_trace_svg]));
    traceItems = learnItems
      .filter((it) => svgByItem.get(it.id))
      .map((it) => ({ hanzi: it.hanzi, traceSvg: svgByItem.get(it.id) as string }));
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <Link
          href={`/kid/${childId}/list/${listId}`}
          className="mb-4 inline-block"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ✕ Stop for now
        </Link>
        <LearnEntry
          childId={childId}
          listId={listId}
          items={learnItems}
          initialXp={child.xp}
          traceItems={traceItems}
        />
      </div>
    </main>
  );
}
