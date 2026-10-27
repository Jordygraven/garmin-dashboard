import type { Point } from "@/lib/plateau";

export default function Spark({ points }: { points: Point[] }) {
  if (points.length < 2) return null;
  const v = points.map((p) => p.value);
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = points
    .map((p, i) => `${((i / (points.length - 1)) * 300).toFixed(1)},${(44 - ((p.value - lo) / span) * 40).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 300 48" style={{ width: "100%", height: 48, marginTop: 12 }}>
      <polyline points={pts} fill="none" stroke="#2f8f5b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
