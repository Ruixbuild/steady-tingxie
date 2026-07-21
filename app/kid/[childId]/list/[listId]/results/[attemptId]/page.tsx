import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AttemptDetail } from "@/lib/supabase/types";
import Confetti from "@/components/Confetti";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ childId: string; listId: string; attemptId: string }>;
}) {
  const { childId, listId, attemptId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, child_id, list_id, mode, supervised, score, total, detail, duration_s")
    .eq("id", attemptId)
    .eq("child_id", childId)
    .eq("list_id", listId)
    .maybeSingle();

  if (!attempt) notFound();

  const detail = attempt.detail as AttemptDetail;
  const pct = attempt.total > 0 ? Math.round((100 * attempt.score) / attempt.total) : 0;
  const perfect = pct === 100 && attempt.total > 0;

  const subLines = [
    detail.sections.words.total > 0 && `词语 ${detail.sections.words.score}/${detail.sections.words.total}`,
    detail.sections.pinyin.total > 0 && `拼音 ${detail.sections.pinyin.score}/${detail.sections.pinyin.total}`,
    detail.sections.passage.total > 0 && `段落 ${detail.sections.passage.score}/${detail.sections.passage.total}`,
  ].filter(Boolean);

  const bestBefore = detail.best_pct_before ?? -1;
  const newBest = !attempt.supervised && attempt.total > 0 && pct > bestBefore;
  const bestToShow = newBest ? pct : Math.max(bestBefore, 0);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      {perfect && <Confetti />}
      <div className="w-full max-w-xl flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-center">
          {attempt.score} / {attempt.total} ({pct}%)
        </h1>
        <p className="text-center" style={{ color: "var(--mut)" }}>
          {subLines.join(" · ")}
        </p>

        {!attempt.supervised &&
          detail.flipped.map((f) => (
            <p key={f.item_id} className="text-center">
              「{f.hanzi}」was wrong last time — right today! 🎉
            </p>
          ))}

        {!attempt.supervised &&
          (newBest ? (
            <p className="text-center font-semibold">
              🏅 New best! {Math.max(bestBefore, 0)}% → {pct}%
            </p>
          ) : (
            <p className="text-center" style={{ color: "var(--mut)" }}>
              Best so far: {bestToShow}%
            </p>
          ))}

        <div className="flex flex-wrap justify-center gap-2">
          {subLines.map((line) => (
            <span key={line as string} className="chip">
              {line}
            </span>
          ))}
        </div>

        {!perfect && detail.tricky_item_ids.length > 0 && (
          <Link
            href={`/kid/${childId}/list/${listId}/learn?items=${detail.tricky_item_ids.join(",")}&fromTest=1`}
            className="btn btn-primary self-center"
          >
            📖 Practise my tricky words
          </Link>
        )}

        <Link href={`/kid/${childId}/list/${listId}`} className="btn btn-secondary self-center">
          Back to hub
        </Link>
      </div>
    </main>
  );
}
