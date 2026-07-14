export default function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const width = 600;
  const height = 80;
  const padding = 2;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = (width - padding * 2) / data.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Daily counts over the last 30 days"
    >
      {data.map((d, i) => {
        const barHeight = d.value > 0 ? Math.max(2, (d.value / max) * (height - 8)) : 0;
        const x = padding + i * barWidth;
        const y = height - barHeight;
        return (
          <rect
            key={d.label}
            x={x + 0.5}
            y={y}
            width={Math.max(1, barWidth - 1)}
            height={barHeight}
            fill="var(--accent)"
          >
            <title>{`${d.label}: ${d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
