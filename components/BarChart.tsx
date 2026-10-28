import { pickTicks } from "@/lib/chartTicks";
import { shortDay } from "@/lib/format";
import type { Point } from "@/lib/plateau";
import { netBarGeom, type Bar } from "@/lib/series";

const W = 330, MID = 70, H = 60, TICK_Y = 150;

/** One net bar per day (charged minus drained): green above the zero line, red below, with the 7-day average of net. */
export default function BarChart({ bars, avg }: { bars: Bar[]; avg: Point[] }) {
  const n = bars.length;
  const step = W / n, bw = Math.min(12, step * 0.6);
  const mx = Math.max(1, ...bars.map((b) => Math.abs(b.net)));
  const cx = (i: number) => step * (i + 0.5);
  const ticks = pickTicks(bars.map((b) => shortDay(b.day)), cx, W);
  const av = new Map(avg.map((p) => [p.day, p.value]));
  const line = bars.flatMap((b, i) => (av.has(b.day) ? [`${cx(i).toFixed(1)},${(MID - (av.get(b.day)! / mx) * H).toFixed(1)}`] : [])).join(" ");

  return (
    <svg viewBox={`0 0 ${W} 160`} style={{ width: "100%", height: 160, marginTop: 10 }} role="img" aria-label="Body battery net per day">
      <line x1="0" y1={MID} x2={W} y2={MID} stroke="#2a3530" />
      {bars.map((b, i) => {
        const g = netBarGeom(b.net, mx, H);
        return <rect key={b.day} x={cx(i) - bw / 2} y={MID + g.top} width={bw} height={g.height} fill={g.color} />;
      })}
      {n > 1 && <polyline points={line} fill="none" stroke="#eef3ef" strokeOpacity="0.7" strokeWidth="1.5" />}
      {ticks.map((t) => (
        <text key={t.index} x={t.x} y={TICK_Y} textAnchor={t.anchor} fontSize="10" fill="#7d8c83">{t.text}</text>
      ))}
    </svg>
  );
}
