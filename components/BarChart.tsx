import { pickTicks } from "@/lib/chartTicks";
import { shortDay } from "@/lib/format";
import type { Point } from "@/lib/plateau";
import type { Bar } from "@/lib/series";

const W = 330, MID = 70, H = 60, TICK_Y = 150;

/** Daily bars: charged above the axis (green), drained below (red), with 7-day average lines. */
export default function BarChart({ bars, avgCharged, avgDrained }: { bars: Bar[]; avgCharged: Point[]; avgDrained: Point[] }) {
  const n = bars.length;
  const step = W / n, bw = Math.min(12, step * 0.6);
  const mx = Math.max(1, ...bars.flatMap((b) => [b.charged, b.drained]));
  const cx = (i: number) => step * (i + 0.5);
  const ticks = pickTicks(bars.map((b) => shortDay(b.day)), cx, W);
  const line = (pts: Point[], dir: 1 | -1) => {
    const v = new Map(pts.map((p) => [p.day, p.value]));
    return bars.flatMap((b, i) => (v.has(b.day) ? [`${cx(i).toFixed(1)},${(MID - dir * (v.get(b.day)! / mx) * H).toFixed(1)}`] : [])).join(" ");
  };

  return (
    <svg viewBox={`0 0 ${W} 160`} style={{ width: "100%", height: 160, marginTop: 10 }} role="img" aria-label="Body battery charged and drained">
      <line x1="0" y1={MID} x2={W} y2={MID} stroke="#2a3530" />
      {bars.map((b, i) => (
        <g key={b.day}>
          <rect x={cx(i) - bw / 2} y={MID - (b.charged / mx) * H} width={bw} height={(b.charged / mx) * H} fill="#2f8f5b" />
          <rect x={cx(i) - bw / 2} y={MID} width={bw} height={(b.drained / mx) * H} fill="#d9534f" />
        </g>
      ))}
      {n > 1 && (
        <>
          <polyline points={line(avgCharged, 1)} fill="none" stroke="#eef3ef" strokeOpacity="0.7" strokeWidth="1.5" />
          <polyline points={line(avgDrained, -1)} fill="none" stroke="#eef3ef" strokeOpacity="0.7" strokeWidth="1.5" />
        </>
      )}
      {ticks.map((t) => (
        <text key={t.index} x={t.x} y={TICK_Y} textAnchor={t.anchor} fontSize="10" fill="#7d8c83">{t.text}</text>
      ))}
    </svg>
  );
}
