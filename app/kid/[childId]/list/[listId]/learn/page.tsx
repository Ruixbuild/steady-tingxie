import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";
import LearnEntry from "./LearnEntry";
import type { LearnItem } from "./LearnSession";

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string; listId: string }>;
  searchParams: Promise<{ items?: string; fromTest?: string }>;
}) {
  const { childId, listId } = await params;
  const { items: itemsParam, fromTest } = await searchParams;

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
    .select("id")
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

  const passageItemIds: string[] = [];
  for (const section of sections ?? []) {
    if (section.kind !== "passage") continue;
    for (const it of section.items ?? []) passageItemIds.push(it.id);
  }
  const { data: passageMasteryRows } =
    passageItemIds.length > 0
      ? await supabase
          .from("mastery")
          .select("item_id, char_misses")
          .eq("child_id", childId)
          .in("item_id", passageItemIds)
      : { data: [] };
  const charMissesByItem = new Map(
    (passageMasteryRows ?? []).map((m) => [m.item_id, m.char_misses as Record<string, number>])
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
        charMisses: kind === "passage" ? charMissesByItem.get(it.id) : undefined,
      }));
    allItems = allItems.concat(sectionItems);
  }

  let learnItems = allItems;
  if (itemsParam) {
    const requestedIds = new Set(itemsParam.split(",").filter(Boolean));
    // Re-validate against this list's own items — RLS already stops cross-child
    // access, but a hand-edited URL could otherwise reference a valid item
    // from a *different* list the same child owns.
    learnItems = allItems.filter((it) => requestedIds.has(it.id));
  }

  let traceItems: { hanzi: string; traceSvg: string }[] = [];
  if (fromTest === "1" && learnItems.length > 0) {
    const { data: masteryRows } = await supabase
      .from("mastery")
      .select("item_id, last_trace_svg")
      .eq("child_id", childId)
      .in(
        "item_id",
        learnItems.map((it) => it.id)
      );
    const svgByItem = new Map((masteryRows ?? []).map((m) => [m.item_id, m.last_trace_svg]));
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
