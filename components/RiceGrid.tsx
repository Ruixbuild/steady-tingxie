// 米字格 (rice-grid) guide: dashed cross + corner-to-corner diagonals,
// drawn behind the writing canvas so pen/touch strokes land inside a
// familiar Chinese-exercise-book frame. Purely decorative — never
// intercepts pointer events.
export default function RiceGrid() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <g stroke="#DDE6EE" strokeWidth={1} strokeDasharray="4 3">
        <line x1={50} y1={0} x2={50} y2={100} />
        <line x1={0} y1={50} x2={100} y2={50} />
        <line x1={0} y1={0} x2={100} y2={100} />
        <line x1={100} y1={0} x2={0} y2={100} />
      </g>
    </svg>
  );
}
