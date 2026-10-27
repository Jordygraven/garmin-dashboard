import { shortDay } from "@/lib/format";
import { findPlateaus, type Point } from "@/lib/plateau";

const W = 330, AXIS = 140, TOP = 18, BOT = 128, XR = 326;

export default function FitnessChart({ points }: { points: Point[] }) {
  const n = points.length;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => (n === 1 ? XR : (i / (n - 1)) * XR);
  const y = (v: number) => BOT - ((v - lo) / span) * (BOT - TOP);
  const iHi = vals.indexOf(hi), iLo = vals.indexOf(lo);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (n - 1)));

  return (
    <svg viewBox={`0 0 ${W} 170`} style={{ width: "100%", height: 170, marginTop: 10 }} role="img" aria-label="Fitness over time">
      {findPlateaus(points).map((s) => (
        <g key={s.start}>
          <rect x={x(s.start)} y={0} width={x(s.end) - x(s.start)} height={AXIS} fill="#2f8f5b" opacity="0.1" />
          {x(s.end) - x(s.start) > 40 && (
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
          <text x={Math.min(Math.max(x(iHi), 30), XR - 20)} y={y(hi) - 8} textAnchor="middle" fontSize="10" fill="#8fd18a">Peak {Math.round(hi)}</text>
          <circle cx={x(iLo)} cy={y(lo)} r="3.5" fill="#d9534f" />
          <text x={Math.min(Math.max(x(iLo), 24), XR - 24)} y={AXIS + 12} textAnchor="middle" fontSize="10" fill="#d9534f">Low {Math.round(lo)}</text>
        </>
      )}
      {ticks.map((i, k) => (
        <text key={k} x={x(i)} y={168} textAnchor={k === 0 ? "start" : k === ticks.length - 1 ? "end" : "middle"} fontSize="10" fill="#7d8c83">
          {shortDay(points[i].day)}
        </text>
      ))}
    </svg>
  );
}
