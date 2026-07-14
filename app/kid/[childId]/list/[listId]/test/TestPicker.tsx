import Link from "next/link";

type Props = {
  childId: string;
  listId: string;
  listName: string;
  predicted: number;
  counts: { words: number; pinyin: number; passage: number; tricky: number };
  supervised: boolean;
};

export default function TestPicker({ childId, listId, listName, predicted, counts, supervised }: Props) {
  const base = `/kid/${childId}/list/${listId}/test`;
  const sup = supervised ? "&supervised=true" : "";

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

        <Link href={`${base}?mode=full${sup}`} className="card p-5 flex flex-col gap-1">
          <span className="font-semibold">🏫 Full test — the app guesses ~{predicted}%. Beat it!</span>
        </Link>

        {counts.words > 0 && (
          <Link href={`${base}?mode=words${sup}`} className="card p-5">
            词语 ({counts.words})
          </Link>
        )}
        {counts.pinyin > 0 && (
          <Link href={`${base}?mode=pinyin${sup}`} className="card p-5">
            拼音 ({counts.pinyin})
          </Link>
        )}
        {counts.passage > 0 && (
          <Link href={`${base}?mode=passage${sup}`} className="card p-5">
            段落
          </Link>
        )}
        {counts.tricky > 0 && (
          <Link href={`${base}?mode=tricky${sup}`} className="card p-5">
            Tricky words ({counts.tricky})
          </Link>
        )}
      </div>
    </main>
  );
}
