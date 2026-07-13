import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";

const KIND_LABEL: Record<SectionKind, string> = {
  words: "词语",
  pinyin: "拼音",
  passage: "段落",
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

  const { data: sections } = await supabase
    .from("sections")
    .select("id, kind, title, items(count)")
    .eq("list_id", listId)
    .order("ord");

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold mb-1">{list.name}</h1>
        <p className="mb-6" style={{ color: "var(--mut)" }}>
          {list.test_date ? `Test on ${list.test_date}` : "No test date set"} · {list.status}
        </p>

        <div className="card p-5 mb-6">
          <p className="font-semibold mb-1">Sections</p>
          <p style={{ color: "var(--mut)" }}>
            {sections && sections.length > 0
              ? sections
                  .map((s) => {
                    const count = Array.isArray(s.items) ? (s.items[0]?.count ?? 0) : 0;
                    return `${KIND_LABEL[s.kind as SectionKind]} ${count}`;
                  })
                  .join(" · ")
              : "No sections yet"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/kid/${childId}/list/${listId}/learn`} className="btn btn-primary">
            Learn
          </Link>
          <Link href={`/kid/${childId}/list/${listId}/test`} className="btn btn-secondary">
            Test
          </Link>
        </div>
      </div>
    </main>
  );
}
