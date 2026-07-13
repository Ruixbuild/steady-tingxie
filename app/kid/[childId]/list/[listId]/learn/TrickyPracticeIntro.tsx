"use client";

type TraceItem = { hanzi: string; traceSvg: string };

export default function TrickyPracticeIntro({
  items,
  onStart,
}: {
  items: TraceItem[];
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-center">You&apos;ve written this before</h2>
      <p className="text-center" style={{ color: "var(--mut)" }}>
        You can do it again.
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        {items.map((item) => (
          <div key={item.hanzi} className="card p-3" style={{ width: 100, height: 100 }}>
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: item.traceSvg }}
              aria-label={`your previous trace of ${item.hanzi}`}
            />
          </div>
        ))}
      </div>

      <button type="button" onClick={onStart} className="btn btn-primary">
        Start practising
      </button>
      <div style={{ minHeight: 56 }} aria-hidden />
    </div>
  );
}
