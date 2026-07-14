export default function Sparkline({
  attempts,
  testDate,
}: {
  attempts: { takenAt: string; pct: number }[];
  testDate: string | null;
}) {
  const width = 320;
  const height = 100;
  const padding = 14;

  if (attempts.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--mut)" }}>
        No full tests taken yet.
      </p>
    );
  }

  const timestamps = attempts.map((a) => new Date(a.takenAt).getTime());
  const testTs = testDate ? new Date(testDate).getTime() : null;
  const allTs = testTs !== null ? [...timestamps, testTs] : timestamps;
  const minTs = Math.min(...allTs);
  const maxTs = Math.max(...allTs);
  const span = Math.max(1, maxTs - minTs);

  const xFor = (ts: number) => padding + ((ts - minTs) / span) * (width - 2 * padding);
  const yFor = (pct: number) => height - padding - (pct / 100) * (height - 2 * padding);

  const points = attempts
    .map((a) => `${xFor(new Date(a.takenAt).getTime())},${yFor(a.pct)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Score history over time"
    >
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="var(--line)"
        strokeWidth={1}
      />
      {testTs !== null && (
        <line
          x1={xFor(testTs)}
          y1={padding}
          x2={xFor(testTs)}
          y2={height - padding}
          stroke="var(--warn)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {attempts.map((a, i) => (
        <circle
          key={i}
          cx={xFor(new Date(a.takenAt).getTime())}
          cy={yFor(a.pct)}
          r={3}
          fill="var(--accent)"
        />
      ))}
    </svg>
  );
}
