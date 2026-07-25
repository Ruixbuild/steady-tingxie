import Link from "next/link";

type Props = {
  childId: string;
  listId: string;
  listName: string;
  counts: { words: number; pinyin: number; passage: number; tricky: number };
};

export default function LearnPicker({ childId, listId, listName, counts }: Props) {
  const base = `/kid/${childId}/list/${listId}/learn`;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-4">
        <Link
          href={`/kid/${childId}/list/${listId}`}
          className="inline-block"
          style={{ color: "var(--accent)", fontWeight: 700 }}
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold">{listName}</h1>

        <Link href={`${base}?mode=full`} className="card p-5 flex flex-col gap-1">
          <span className="font-semibold">🏫 Full practice</span>
        </Link>

        {counts.words > 0 && (
          <Link href={`${base}?mode=words`} className="card p-5">
            词语 ({counts.words})
          </Link>
        )}
        {counts.pinyin > 0 && (
          <Link href={`${base}?mode=pinyin`} className="card p-5">
            拼音 ({counts.pinyin})
          </Link>
        )}
        {counts.passage > 0 && (
          <Link href={`${base}?mode=passage`} className="card p-5">
            默写 ({counts.passage})
          </Link>
        )}
        {counts.tricky > 0 && (
          <Link href={`${base}?mode=tricky`} className="card p-5">
            Tricky words ({counts.tricky})
          </Link>
        )}
      </div>
    </main>
  );
}
