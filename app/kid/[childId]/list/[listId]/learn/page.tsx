import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";
import LearnSession, { type LearnItem } from "./LearnSession";

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string; listId: string }>;
  searchParams: Promise<{ items?: string }>;
}) {
  const { childId, listId } = await params;
  const { items: itemsParam } = await searchParams;

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

  let allItems: LearnItem[] = [];
  for (const section of sections ?? []) {
    if (section.kind === "passage") continue;
    const kind = section.kind as "words" | "pinyin";
    const sectionItems = (section.items ?? [])
      .slice()
      .sort((a, b) => a.ord - b.ord)
      .map((it) => ({ id: it.id, hanzi: it.hanzi, pinyin: it.pinyin, kind }));
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

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <LearnSession childId={childId} listId={listId} items={learnItems} initialXp={child.xp} />
      </div>
    </main>
  );
}
