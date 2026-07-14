import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";
import EditListForm, { type EditableSectionDraft } from "./EditListForm";

type SectionRaw = {
  id: string;
  kind: SectionKind;
  title: string | null;
  pick_n: number | null;
  items: { id: string; hanzi: string; pinyin: string | null; english: string | null }[] | null;
};

export default async function EditListPage({
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

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, test_date")
    .eq("id", listId)
    .eq("child_id", childId)
    .maybeSingle();
  if (!list) notFound();

  const { data: sectionsRaw } = await supabase
    .from("sections")
    .select("id, kind, title, pick_n, ord, items(id, hanzi, pinyin, english)")
    .eq("list_id", listId)
    .order("ord");
  const sections = sectionsRaw as unknown as SectionRaw[];

  const initialSections: EditableSectionDraft[] = (sections ?? []).map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title ?? "",
    pickN: s.pick_n != null ? String(s.pick_n) : "",
    items: (s.items ?? []).map((it) => ({
      id: it.id,
      hanzi: it.hanzi,
      pinyin: it.pinyin ?? "",
      english: it.english ?? "",
    })),
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold mb-6">Edit {list.name}</h1>
        <EditListForm
          childId={childId}
          listId={listId}
          initialName={list.name}
          initialTestDate={list.test_date ?? ""}
          initialSections={initialSections}
        />
      </div>
    </main>
  );
}
