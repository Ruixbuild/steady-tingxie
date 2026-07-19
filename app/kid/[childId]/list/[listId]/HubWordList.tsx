const STAGE_EMOJI = ["🌱", "🌿", "🌸", "🌳"] as const;

export type HubSection = {
  kind: "words" | "pinyin" | "passage";
  items: { id: string; hanzi: string; level: number }[];
};

const KIND_HEADER: Record<HubSection["kind"], string> = {
  words: "✍ 写字 / 词语",
  pinyin: "🔤 拼音",
  passage: "🖋 默写",
};

export default function HubWordList({ sections }: { sections: HubSection[] }) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      {sections.map((s, i) => (
        <div key={i}>
          <p className="text-sm mb-2" style={{ color: "var(--mut)" }}>
            {KIND_HEADER[s.kind]}
          </p>
          <div className="flex flex-wrap gap-2">
            {s.items.map((it) => (
              <div
                key={it.id}
                className="hanzi flex items-center gap-1 rounded-2xl px-3 py-2 text-lg"
                style={{ background: "#fff", border: "1.5px solid var(--line)" }}
              >
                {it.hanzi}
                <span className="text-sm">{STAGE_EMOJI[it.level] ?? "🌱"}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
