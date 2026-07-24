import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";
import { daysUntil } from "@/lib/dates";
import ChildHomeHero from "./ChildHomeHero";
import ListSelector from "./ListSelector";

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function currentMondaySGT(): string {
  const sgtShifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const day = sgtShifted.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  sgtShifted.setUTCDate(sgtShifted.getUTCDate() - diffToMonday);
  return sgtShifted.toISOString().slice(0, 10);
}

export default async function ChildHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ list?: string }>;
}) {
  const { childId } = await params;
  const { list: requestedListId } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: child } = await supabase
    .from("children")
    .select(
      "id, name, level, emoji, xp, streak, cheer, chars_written_week, chars_week_start, revision_enabled"
    )
    .eq("id", childId)
    .maybeSingle();

  if (!child) {
    notFound();
  }

  let pendingRevisionAssignments: { chapterId: string; chapterTitle: string }[] = [];
  if (child.revision_enabled) {
    const { data: assignmentsRaw } = await supabase
      .from("revision_assignments")
      .select("chapter_id")
      .eq("child_id", childId)
      .eq("status", "pending");

    const chapterIds = Array.from(new Set((assignmentsRaw ?? []).map((a) => a.chapter_id)));
    if (chapterIds.length > 0) {
      const { data: chaptersRaw } = await supabase
        .from("curriculum_chapters")
        .select("id, title")
        .in("id", chapterIds);
      const titleByChapterId = new Map((chaptersRaw ?? []).map((c) => [c.id, c.title]));
      pendingRevisionAssignments = chapterIds.map((id) => ({
        chapterId: id,
        chapterTitle: titleByChapterId.get(id) ?? "Revision",
      }));
    }
  }

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, test_date, status")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });

  const { data: activeListsRaw } = await supabase
    .from("lists")
    .select("id, name, test_date")
    .eq("child_id", childId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  const activeLists = activeListsRaw ?? [];
  const activeListRow =
    activeLists.find((l) => l.id === requestedListId) ?? activeLists[0] ?? null;

  let pinnedIds: string[] = [];
  let queueIds: string[] = [];
  let surpriseId: string | null = null;

  if (activeListRow) {
    const { data: sectionsRaw } = await supabase
      .from("sections")
      .select("kind, items(id)")
      .eq("list_id", activeListRow.id);

    const sections = sectionsRaw as unknown as {
      kind: SectionKind;
      items: { id: string }[] | null;
    }[];

    const nonPassageItemIds: string[] = [];
    const passageItemIds: string[] = [];
    for (const section of sections ?? []) {
      if (section.kind === "passage") {
        for (const item of section.items ?? []) passageItemIds.push(item.id);
      } else {
        for (const item of section.items ?? []) nonPassageItemIds.push(item.id);
      }
    }

    if (nonPassageItemIds.length > 0) {
      const { data: masteryRows } = await supabase
        .from("mastery")
        .select("item_id, level, misses, pinned")
        .eq("child_id", childId)
        .in("item_id", nonPassageItemIds);

      const rows = masteryRows ?? [];
      pinnedIds = rows.filter((m) => m.pinned).map((m) => m.item_id).slice(0, 5);

      const strugglingSorted = rows
        .filter((m) => m.misses > 0)
        .sort((a, b) => b.misses - a.misses)
        .map((m) => m.item_id);
      const untouched = rows
        .filter((m) => m.level === 0 && m.misses === 0)
        .map((m) => m.item_id);
      queueIds = Array.from(new Set([...strugglingSorted, ...untouched]));

      const nonMastered = rows.filter((m) => m.level < 3).map((m) => m.item_id);
      surpriseId = pickRandom(nonMastered);
    }

    // A parent-pinned 默写 passage doesn't compete for the "N words today"
    // slot count — it's a whole sentence, not a word — but it still needs
    // to surface as picked-for-you practice, so it's added on top.
    if (passageItemIds.length > 0) {
      const { data: passageMasteryRows } = await supabase
        .from("mastery")
        .select("item_id, pinned")
        .eq("child_id", childId)
        .in("item_id", passageItemIds);
      const pinnedPassageIds = (passageMasteryRows ?? [])
        .filter((m) => m.pinned)
        .map((m) => m.item_id);
      pinnedIds = [...pinnedIds, ...pinnedPassageIds];
    }
  }

  const effortChars =
    child.chars_week_start === currentMondaySGT() ? child.chars_written_week : 0;
  const daysToTest = activeListRow?.test_date ? daysUntil(activeListRow.test_date) : null;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl">
        <Link
          href="/"
          className="mb-4 inline-block"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Switch profile
        </Link>
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-4xl">{child.emoji}</span>
            <div>
              <h1 className="text-2xl font-semibold">{child.name}</h1>
              <p style={{ color: "var(--mut)" }}>{child.level}</p>
            </div>
            <Link
              href={`/kid/${childId}/garden`}
              className="card flex items-center gap-1.5 px-4 py-2"
            >
              <span className="text-lg leading-none">🌳</span>
              <span
                className="text-sm font-semibold whitespace-nowrap"
                style={{ color: "var(--accent-d)" }}
              >
                Visit garden
              </span>
            </Link>
          </div>
          <div className="text-right text-sm shrink-0" style={{ color: "var(--mut)" }}>
            <p>
              🔥{child.streak} day{child.streak === 1 ? "" : "s"} in a row
            </p>
          </div>
        </div>

        <p className="mb-6 text-sm" style={{ color: "var(--mut)" }}>
          You&apos;ve written {effortChars} characters this week!
        </p>

        {activeListRow && (
          <ListSelector
            childId={childId}
            lists={activeLists}
            selectedId={activeListRow.id}
          />
        )}

        <div className="mb-8">
          <ChildHomeHero
            childId={childId}
            cheer={child.cheer}
            activeList={
              activeListRow
                ? { id: activeListRow.id, name: activeListRow.name, testDate: activeListRow.test_date }
                : null
            }
            daysToTest={daysToTest}
            pinnedIds={pinnedIds}
            queueIds={queueIds}
            surpriseId={surpriseId}
          />
        </div>

        <h2 className="text-lg font-semibold mb-3">My lists</h2>
        <div className="flex flex-col gap-3">
          {(!lists || lists.length === 0) && (
            <p style={{ color: "var(--mut)" }}>
              No lists yet — ask a grown-up to add one in the parent corner ⚙
            </p>
          )}
          {lists?.map((list) => (
            <Link
              key={list.id}
              href={`/kid/${childId}/list/${list.id}`}
              className="card flex items-center justify-between p-5"
            >
              <span className="font-semibold">{list.name}</span>
              <span className="text-sm" style={{ color: "var(--mut)" }}>
                {list.test_date ?? list.status}
              </span>
            </Link>
          ))}
        </div>

        {child.revision_enabled && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-3">Revision</h2>
            <div className="flex flex-col gap-3">
              {pendingRevisionAssignments.map((a) => (
                <Link
                  key={a.chapterId}
                  href={`/kid/${childId}/revision/${a.chapterId}/test`}
                  className="card flex items-center justify-between p-5"
                  style={{ borderColor: "var(--accent)" }}
                >
                  <span className="font-semibold">📌 任务: {a.chapterTitle}</span>
                  <span className="text-sm" style={{ color: "var(--accent-d)" }}>
                    Start
                  </span>
                </Link>
              ))}
              <Link
                href={`/kid/${childId}/revision`}
                className="card flex items-center justify-between p-5"
              >
                <span className="font-semibold">📚 Browse Revision</span>
                <span className="text-sm" style={{ color: "var(--mut)" }}>
                  Read · Write · Test
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
