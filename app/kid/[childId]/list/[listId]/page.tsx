import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";
import HubWordList, { type HubSection } from "./HubWordList";

const KIND_LABEL: Record<SectionKind, string> = {
  words: "词语",
  pinyin: "拼音",
  passage: "默写",
};

type SectionRaw = {
  kind: SectionKind;
  items: { id: string; hanzi: string }[] | null;
};

export default async function ListHubPage({
  params,
}: {
  params: Promise<{ childId: string; listId: string }>;
}) {
  const { childId, listId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, test_date, status")
    .eq("id", listId)
    .eq("child_id", childId)
    .maybeSingle();

  if (!list) {
    notFound();
  }

  const { data: sectionsRaw } = await supabase
    .from("sections")
    .select("kind, items(id, hanzi)")
    .eq("list_id", listId)
    .order("ord");
  const sections = sectionsRaw as unknown as SectionRaw[];

  const sectionsSummary =
    sections && sections.length > 0
      ? sections
          .map((s) => `${KIND_LABEL[s.kind]} ${(s.items ?? []).length}`)
          .join(" · ")
      : "No sections yet";

  const allItemIds = (sections ?? []).flatMap((s) => (s.items ?? []).map((it) => it.id));
  const { data: masteryRows } =
    allItemIds.length > 0
      ? await supabase
          .from("mastery")
          .select("item_id, level")
          .eq("child_id", childId)
          .in("item_id", allItemIds)
      : { data: [] };
  const levelByItem = new Map((masteryRows ?? []).map((m) => [m.item_id, m.level]));
  const hubSections: HubSection[] = (sections ?? []).map((s) => ({
    kind: s.kind as "words" | "pinyin" | "passage",
    items: (s.items ?? []).map((it) => ({
      id: it.id,
      hanzi: it.hanzi,
      level: levelByItem.get(it.id) ?? 0,
    })),
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <Link
          href={`/kid/${childId}`}
          className="mb-4 inline-block"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold mb-1">{list.name}</h1>
        <p className="mb-6" style={{ color: "var(--mut)" }}>
          {list.test_date ? `Test on ${list.test_date}` : "No test date set"} · {list.status}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Link
            href={`/kid/${childId}/list/${listId}/learn`}
            className="rounded-[18px] p-5 flex flex-col gap-1"
            style={{ background: "var(--accent-soft)", color: "var(--accent-d)" }}
          >
            <span className="text-3xl">📖</span>
            <span className="font-semibold text-lg">Learn</span>
            <span className="text-sm opacity-80">watch. trace. write</span>
          </Link>

          <Link
            href={`/kid/${childId}/list/${listId}/test`}
            className="rounded-[18px] p-5 flex flex-col gap-1"
            style={{ background: "var(--warn-soft)", color: "#8A6412" }}
          >
            <span className="text-3xl">✏️</span>
            <span className="font-semibold text-lg">Test</span>
            <span className="text-sm opacity-80">like the real thing</span>
          </Link>

          <Link
            href={`/kid/${childId}/list/${listId}/progress`}
            className="rounded-[18px] p-5 flex flex-col gap-1"
            style={{ background: "var(--ok-soft)", color: "#3E7A4E" }}
          >
            <span className="text-3xl">🌳</span>
            <span className="font-semibold text-lg">Progress</span>
            <span className="text-sm opacity-80">my word garden</span>
          </Link>
        </div>

        <div className="card p-5 mb-6">
          <p className="font-semibold mb-1">Sections</p>
          <p style={{ color: "var(--mut)" }}>{sectionsSummary}</p>
        </div>

        {hubSections.length > 0 && <HubWordList sections={hubSections} />}
      </div>
    </main>
  );
}
