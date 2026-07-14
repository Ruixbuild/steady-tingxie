import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";
import { isTricky, passageQuizPositions, predictedPct } from "@/lib/testScoring";
import { daysUntil } from "@/lib/dates";
import ChildFocusCard, { type FocusData } from "./ChildFocusCard";
import ParentTabs from "./ParentTabs";

type SectionRaw = {
  kind: SectionKind;
  items: { id: string; hanzi: string }[] | null;
};

export default async function ParentPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: children } = await supabase
    .from("children")
    .select("id, name, last_summary")
    .order("created_at", { ascending: true });

  const focusData: FocusData[] = [];

  for (const child of children ?? []) {
    const { data: activeListsRaw } = await supabase
      .from("lists")
      .select("id, name, test_date")
      .eq("child_id", child.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    const activeList = activeListsRaw?.[0] ?? null;

    const base: FocusData = {
      childId: child.id,
      childName: child.name,
      lastSummary: child.last_summary,
      activeList: null,
      daysToTest: null,
      predicted: 0,
      sections: [],
      weakTop5: [],
      weakByKind: { words: [], pinyin: [] },
    };

    if (!activeList) {
      focusData.push(base);
      continue;
    }

    const { data: sectionsRaw } = await supabase
      .from("sections")
      .select("kind, items(id, hanzi)")
      .eq("list_id", activeList.id);
    const sections = sectionsRaw as unknown as SectionRaw[];

    const nonPassageItemIds: string[] = [];
    for (const s of sections ?? []) {
      if (s.kind === "passage") continue;
      for (const it of s.items ?? []) nonPassageItemIds.push(it.id);
    }

    const { data: masteryRows } =
      nonPassageItemIds.length > 0
        ? await supabase
            .from("mastery")
            .select("item_id, level, misses")
            .eq("child_id", child.id)
            .in("item_id", nonPassageItemIds)
        : { data: [] };

    const masteryByItem = new Map((masteryRows ?? []).map((m) => [m.item_id, m]));

    const nonPassageLevels: number[] = [];
    const passageCharMissed: boolean[] = [];
    for (const s of sections ?? []) {
      if (s.kind === "passage") {
        // predicted% needs passage char_misses too
        for (const it of s.items ?? []) {
          const { data: passMastery } = await supabase
            .from("mastery")
            .select("char_misses")
            .eq("child_id", child.id)
            .eq("item_id", it.id)
            .maybeSingle();
          const misses = (passMastery?.char_misses ?? {}) as Record<string, number>;
          for (const pos of passageQuizPositions(it.hanzi)) {
            passageCharMissed.push((misses[String(pos)] ?? 0) > 0);
          }
        }
      } else {
        for (const it of s.items ?? []) {
          nonPassageLevels.push(masteryByItem.get(it.id)?.level ?? 0);
        }
      }
    }
    const predicted = predictedPct({ nonPassageLevels, passageCharMissed });

    const sectionLights = (sections ?? [])
      .filter((s) => s.kind !== "passage")
      .map((s) => {
        const items = s.items ?? [];
        const masteredCount = items.filter(
          (it) => (masteryByItem.get(it.id)?.level ?? 0) >= 2
        ).length;
        const r = items.length > 0 ? masteredCount / items.length : 0;
        const light = r >= 0.8 ? ("green" as const) : r >= 0.5 ? ("orange" as const) : ("red" as const);
        return { kind: s.kind as "words" | "pinyin", r, light };
      });

    const trickyItems = (sections ?? [])
      .filter((s) => s.kind !== "passage")
      .flatMap((s) =>
        (s.items ?? [])
          .map((it) => {
            const m = masteryByItem.get(it.id);
            return {
              item_id: it.id,
              hanzi: it.hanzi,
              kind: s.kind as "words" | "pinyin",
              level: m?.level ?? 0,
              misses: m?.misses ?? 0,
            };
          })
          .filter((it) => isTricky(it.kind, it.level, it.misses))
      )
      .sort((a, b) => b.misses - a.misses || a.level - b.level);

    const weakTop5 = trickyItems.slice(0, 5).map((it) => ({
      itemId: it.item_id,
      hanzi: it.hanzi,
      kind: it.kind,
    }));

    const weakByKind = {
      words: (() => {
        const w = trickyItems.filter((it) => it.kind === "words");
        return w.length >= 2 ? w.slice(0, 3).map((it) => it.item_id) : [];
      })(),
      pinyin: (() => {
        const p = trickyItems.filter((it) => it.kind === "pinyin");
        return p.length >= 2 ? p.slice(0, 3).map((it) => it.item_id) : [];
      })(),
    };

    const unmasteredCount = nonPassageLevels.filter((l) => l < 2).length;
    const daysToTest = activeList.test_date ? daysUntil(activeList.test_date) : null;
    const wordsPerDay =
      daysToTest && daysToTest > 0 ? Math.ceil(unmasteredCount / daysToTest) : null;
    const weakCount = trickyItems.length;
    const planPinCount =
      daysToTest && daysToTest > 0 ? Math.min(5, Math.ceil(weakCount / daysToTest)) : 0;
    const planPinIds = trickyItems.slice(0, planPinCount).map((it) => it.item_id);

    focusData.push({
      ...base,
      activeList: { id: activeList.id, name: activeList.name },
      daysToTest,
      predicted,
      sections: sectionLights,
      weakTop5,
      weakByKind,
      wordsPerDay,
      planPinIds,
    });
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">⚙ Parent corner</h1>
          <Link href="/onboarding" className="btn btn-sm btn-secondary">
            + Add child
          </Link>
        </div>
        <ParentTabs active="Focus" />
        {focusData.length === 0 && (
          <p style={{ color: "var(--mut)" }}>No children yet.</p>
        )}
        {focusData.map((data) => (
          <ChildFocusCard key={data.childId} data={data} />
        ))}
      </div>
    </main>
  );
}
