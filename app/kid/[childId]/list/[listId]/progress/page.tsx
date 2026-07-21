import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";
import GardenClient from "./GardenClient";

type SectionRaw = {
  kind: SectionKind;
  title: string | null;
  items: { id: string; hanzi: string }[] | null;
};

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ childId: string; listId: string }>;
}) {
  const { childId, listId } = await params;

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
    .select("id, name, bloomed")
    .eq("id", listId)
    .eq("child_id", childId)
    .maybeSingle();
  if (!list) notFound();

  const { data: sectionsRaw } = await supabase
    .from("sections")
    .select("kind, title, ord, items(id, hanzi)")
    .eq("list_id", listId)
    .order("ord");
  const sections = sectionsRaw as unknown as SectionRaw[];

  const allItemIds = (sections ?? []).flatMap((s) => (s.items ?? []).map((it) => it.id));

  const { data: masteryRows } =
    allItemIds.length > 0
      ? await supabase
          .from("mastery")
          .select("item_id, level, misses")
          .eq("child_id", childId)
          .in("item_id", allItemIds)
      : { data: [] };

  const masteryByItem = new Map((masteryRows ?? []).map((m) => [m.item_id, m]));

  const gardenSections = (sections ?? []).map((s) => ({
    kind: s.kind as "words" | "pinyin" | "passage",
    title: s.title,
    items: (s.items ?? []).map((it) => {
      const m = masteryByItem.get(it.id);
      return { id: it.id, hanzi: it.hanzi, level: m?.level ?? 0, misses: m?.misses ?? 0 };
    }),
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <Link
          href={`/kid/${childId}/list/${listId}`}
          className="mb-4 inline-block"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold mb-1">⭐ My word garden</h1>
        <p className="text-sm mb-6" style={{ color: "var(--mut)" }}>
          🌱 new → 🌿 learning → 🌸 almost → 🌳 mastered · tests grow words to 🌳
        </p>
        <GardenClient
          childId={childId}
          listId={listId}
          bloomed={list.bloomed}
          hardMode={child.hard_mode}
          sections={gardenSections}
        />
      </div>
    </main>
  );
}
