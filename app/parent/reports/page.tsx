import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SectionKind } from "@/lib/supabase/types";
import { isTricky, passageQuizPositions } from "@/lib/testScoring";
import ParentTabs from "../ParentTabs";
import Sparkline from "./Sparkline";

type SectionRaw = {
  kind: SectionKind;
  items: { id: string; hanzi: string }[] | null;
};

type ItemRow = { hanzi: string; kind: "words" | "pinyin"; level: number; misses: number };
type PassageRow = { hanzi: string; level: number; totalChars: number; trickyChars: string[] };

export default async function ReportsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: children } = await supabase
    .from("children")
    .select("id, name")
    .order("created_at", { ascending: true });

  const reports = [];

  for (const child of children ?? []) {
    const { data: activeListsRaw } = await supabase
      .from("lists")
      .select("id, name, test_date, status, predicted_at_test, actual_score, actual_total")
      .eq("child_id", child.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const list = activeListsRaw?.[0] ?? null;
    if (!list) {
      reports.push({ childId: child.id, childName: child.name, list: null });
      continue;
    }

    const { data: sectionsRaw } = await supabase
      .from("sections")
      .select("kind, items(id, hanzi)")
      .eq("list_id", list.id);
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

    const itemRows: ItemRow[] = [];
    for (const s of sections ?? []) {
      if (s.kind === "passage") continue;
      for (const it of s.items ?? []) {
        const m = masteryByItem.get(it.id);
        itemRows.push({
          hanzi: it.hanzi,
          kind: s.kind as "words" | "pinyin",
          level: m?.level ?? 0,
          misses: m?.misses ?? 0,
        });
      }
    }
    itemRows.sort((a, b) => b.misses - a.misses || a.level - b.level);

    const passageRows: PassageRow[] = [];
    for (const s of sections ?? []) {
      if (s.kind !== "passage") continue;
      for (const it of s.items ?? []) {
        const { data: passMastery } = await supabase
          .from("mastery")
          .select("level, char_misses")
          .eq("child_id", child.id)
          .eq("item_id", it.id)
          .maybeSingle();
        const charMisses = (passMastery?.char_misses ?? {}) as Record<string, number>;
        const chars = Array.from(it.hanzi);
        const positions = passageQuizPositions(it.hanzi);
        const trickyChars = positions
          .filter((pos) => (charMisses[String(pos)] ?? 0) > 0)
          .map((pos) => chars[pos]);
        passageRows.push({
          hanzi: it.hanzi,
          level: passMastery?.level ?? 0,
          totalChars: positions.length,
          trickyChars,
        });
      }
    }

    const { data: attemptsRaw } = await supabase
      .from("attempts")
      .select("score, total, taken_at")
      .eq("child_id", child.id)
      .eq("list_id", list.id)
      .eq("mode", "full")
      .order("taken_at", { ascending: true });
    const attempts = (attemptsRaw ?? []).map((a) => ({
      takenAt: a.taken_at,
      pct: a.total > 0 ? Math.round((100 * a.score) / a.total) : 0,
    }));

    reports.push({
      childId: child.id,
      childName: child.name,
      list: {
        id: list.id,
        name: list.name,
        testDate: list.test_date,
        status: list.status,
        predictedAtTest: list.predicted_at_test,
        actualScore: list.actual_score,
        actualTotal: list.actual_total,
      },
      itemRows,
      passageRows,
      attempts,
    });
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <Link href="/" className="inline-block" style={{ color: "var(--accent)", fontWeight: 700 }}>
          ← Exit parent corner
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">⚙ Parent corner</h1>
          <Link href="/onboarding" className="btn btn-sm btn-secondary">
            + Add child
          </Link>
        </div>
        <ParentTabs active="Reports" />
        {reports.length === 0 && <p style={{ color: "var(--mut)" }}>No children yet.</p>}
        {reports.map((r) => (
          <div key={r.childId} className="card p-5 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{r.childName}</h2>
            {!r.list ? (
              <p className="text-sm" style={{ color: "var(--mut)" }}>
                No lists yet.
              </p>
            ) : (
              <>
                <p className="text-sm" style={{ color: "var(--mut)" }}>
                  {r.list.name}
                  {r.list.testDate ? ` · test ${r.list.testDate}` : ""}
                </p>

                {r.list.status === "tested" && r.list.predictedAtTest != null && (
                  <p className="font-semibold">
                    Predicted ~{r.list.predictedAtTest}% · Actual {r.list.actualScore}/
                    {r.list.actualTotal}
                  </p>
                )}

                <Sparkline attempts={r.attempts ?? []} testDate={r.list.testDate} />

                {(r.itemRows?.length ?? 0) > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ color: "var(--mut)" }}>
                          <th className="text-left font-normal pb-2">Word</th>
                          <th className="text-left font-normal pb-2">Kind</th>
                          <th className="text-left font-normal pb-2">Level</th>
                          <th className="text-left font-normal pb-2">Misses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.itemRows!.map((it, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                            <td className="hanzi py-1">{it.hanzi}</td>
                            <td className="py-1">{it.kind}</td>
                            <td className="py-1">{it.level}</td>
                            <td className="py-1">
                              {isTricky(it.kind, it.level, it.misses) ? (
                                <span style={{ color: "#B8600B" }}>{it.misses}</span>
                              ) : (
                                it.misses
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(r.passageRows?.length ?? 0) > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm" style={{ color: "var(--mut)" }}>
                      默写
                    </p>
                    {r.passageRows!.map((p, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <p className="hanzi">{p.hanzi}</p>
                        <p className="text-sm" style={{ color: "var(--mut)" }}>
                          Level {p.level} · {p.totalChars - p.trickyChars.length}/{p.totalChars} characters solid
                        </p>
                        {p.trickyChars.length > 0 && (
                          <p className="text-sm">
                            Needs practice:{" "}
                            <span className="hanzi" style={{ color: "#B8600B" }}>
                              {p.trickyChars.join(" ")}
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
