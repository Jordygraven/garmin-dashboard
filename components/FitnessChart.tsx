import { overlaps, pickTicks, textBox } from "@/lib/chartTicks";
import { shortDay } from "@/lib/format";
import { findPlateaus, type Point } from "@/lib/plateau";

const W = 330, AXIS = 140, TOP = 18, BOT = 128, XR = 326, LOW_Y = AXIS + 14, TICK_Y = 168;

export default function FitnessChart({ points }: { points: Point[] }) {
  const n = points.length;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => (n === 1 ? XR : (i / (n - 1)) * XR);
  const y = (v: number) => BOT - ((v - lo) / span) * (BOT - TOP);
  const iHi = vals.indexOf(hi), iLo = vals.indexOf(lo);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = pickTicks(points.map((p) => shortDay(p.day)), x, W);
  const peakText = `Peak ${Math.round(hi)}`;
  const peakX = Math.min(Math.max(x(iHi), textBox(0, "middle", peakText).right), XR - textBox(0, "middle", peakText).right);
  const peakBox = textBox(peakX, "middle", peakText);

  return (
    <svg viewBox={`0 0 ${W} 170`} style={{ width: "100%", height: 170, marginTop: 10 }} role="img" aria-label="Fitness over time">
      {findPlateaus(points).map((s) => (
        <g key={s.start}>
          <rect x={x(s.start)} y={0} width={x(s.end) - x(s.start)} height={AXIS} fill="#2f8f5b" opacity="0.1" />
          {hi !== lo && !overlaps(textBox((x(s.start) + x(s.end)) / 2, "middle", "Plateau"), peakBox, 6) && (
            <text x={(x(s.start) + x(s.end)) / 2} y={12} textAnchor="middle" fontSize="10" fill="#7d8c83">Plateau</text>
          )}
        </g>
      ))}
      <line x1="0" y1={AXIS} x2={W} y2={AXIS} stroke="#2a3530" />
      <line x1="0" y1={AXIS / 2} x2={W} y2={AXIS / 2} stroke="#222b26" strokeDasharray="2 4" />
      <polyline points={line} fill="none" stroke="#2f8f5b" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {hi !== lo && (
        <>
          <circle cx={x(iHi)} cy={y(hi)} r="4" fill="#8fd18a" />
          <text x={peakX} y={y(hi) - 8} textAnchor="middle" fontSize="10" fill="#8fd18a">{peakText}</text>
          <circle cx={x(iLo)} cy={y(lo)} r="3.5" fill="#d9534f" />
          <text x={Math.min(Math.max(x(iLo), 24), XR - 24)} y={LOW_Y} textAnchor="middle" fontSize="10" fill="#d9534f">Low {Math.round(lo)}</text>
        </>
      )}
      {ticks.map((t) => (
        <text key={t.index} x={t.x} y={TICK_Y} textAnchor={t.anchor} fontSize="10" fill="#7d8c83">{t.text}</text>
      ))}
    </svg>
  );
}
