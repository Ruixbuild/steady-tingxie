import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";
import ReaderView from "./ReaderView";

type SectionRaw = {
  kind: SectionKind;
  items: { id: string; hanzi: string }[] | null;
};

export default async function ReaderPage({
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
    .select("id, name")
    .eq("id", listId)
    .eq("child_id", childId)
    .maybeSingle();
  if (!list) notFound();

  const { data: sectionsRaw } = await supabase
    .from("sections")
    .select("kind, items(id, hanzi)")
    .eq("list_id", listId);
  const sections = sectionsRaw as unknown as SectionRaw[];

  const passageItem = (sections ?? [])
    .find((s) => s.kind === "passage")
    ?.items?.[0];

  if (!passageItem) {
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
          <p style={{ color: "var(--mut)" }}>This list has no passage to read.</p>
        </div>
      </main>
    );
  }

  const { data: mastery } = await supabase
    .from("mastery")
    .select("char_misses")
    .eq("child_id", childId)
    .eq("item_id", passageItem.id)
    .maybeSingle();

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
        <h1 className="text-2xl font-semibold mb-6">{list.name}</h1>
        <ReaderView hanzi={passageItem.hanzi} charMisses={mastery?.char_misses ?? {}} />
      </div>
    </main>
  );
}
