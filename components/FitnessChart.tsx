import { overlaps, pickTicks, textBox } from "@/lib/chartTicks";
import { shortDay } from "@/lib/format";
import { findPlateaus, type Point } from "@/lib/plateau";

const W = 330, AXIS = 140, TOP = 18, BOT = 128, XR = 326, LOW_Y = AXIS + 14, TICK_Y = 168;

type Props = {
  points: Point[];
  label?: string;
  plateaus?: boolean;
  avg?: Point[]; // 7-day average line
  zone?: [number, number]; // green band
  target?: number; // solid line
  targetLabel?: string;
  invert?: boolean; // smaller values at the top, with faster/slower edge labels
  format?: (v: number) => string; // peak/low labels
};

export default function FitnessChart({ points, label = "Fitness", plateaus = true, avg, zone, target, targetLabel, invert = false, format = (v) => String(Math.round(v)) }: Props) {
  const n = points.length;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals, ...(zone ?? []), ...(target === undefined ? [] : [target]));
  const hi = Math.max(...vals, ...(zone ?? []), ...(target === undefined ? [] : [target]));
  const span = hi - lo || 1;
  const x = (i: number) => (n === 1 ? XR : (i / (n - 1)) * XR);
  const y = (v: number) => (invert ? TOP + ((v - lo) / span) * (BOT - TOP) : BOT - ((v - lo) / span) * (BOT - TOP));
  const dMax = Math.max(...vals), dMin = Math.min(...vals);
  const dHi = invert ? dMin : dMax, dLo = invert ? dMax : dMin; // best and worst
  const iHi = vals.indexOf(dHi), iLo = vals.indexOf(dLo);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = pickTicks(points.map((p) => shortDay(p.day)), x, W);
  const peakText = `${invert ? "Best" : "Peak"} ${format(dHi)}`;
  const peakX = Math.min(Math.max(x(iHi), textBox(0, "middle", peakText).right), XR - textBox(0, "middle", peakText).right);
  const peakBox = textBox(peakX, "middle", peakText);

  return (
    <svg viewBox={`0 0 ${W} 170`} style={{ width: "100%", height: 170, marginTop: 10 }} role="img" aria-label={`${label} over time`}>
      {(plateaus ? findPlateaus(points) : []).map((s) => (
        <g key={s.start}>
          <rect x={x(s.start)} y={0} width={x(s.end) - x(s.start)} height={AXIS} fill="#2f8f5b" opacity="0.1" />
          {dMax !== dMin && !overlaps(textBox((x(s.start) + x(s.end)) / 2, "middle", "Plateau"), peakBox, 6) && (
            <text x={(x(s.start) + x(s.end)) / 2} y={12} textAnchor="middle" fontSize="10" fill="#7d8c83">Plateau</text>
          )}
        </g>
      ))}
      <line x1="0" y1={AXIS} x2={W} y2={AXIS} stroke="#2a3530" />
      <line x1="0" y1={AXIS / 2} x2={W} y2={AXIS / 2} stroke="#222b26" strokeDasharray="2 4" />
      {zone && <rect x="0" y={y(zone[1])} width={W} height={y(zone[0]) - y(zone[1])} fill="#2f8f5b" opacity="0.15" />}
      {target !== undefined && (
        <>
          <line x1="0" y1={y(target)} x2={W} y2={y(target)} stroke="#eef3ef" strokeWidth="1.5" />
          {targetLabel && <text x={XR} y={y(target) - 5} textAnchor="end" fontSize="10" fill="#eef3ef">{targetLabel}</text>}
        </>
      )}
      {invert && (
        <>
          <text x="0" y={12} fontSize="10" fill="#7d8c83">faster</text>
          <text x="0" y={AXIS - 5} fontSize="10" fill="#7d8c83">slower</text>
        </>
      )}
      <polyline points={line} fill="none" stroke="#2f8f5b" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {avg && avg.length > 1 && (
        <polyline points={avg.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")} fill="none" stroke="#eef3ef" strokeOpacity="0.7" strokeWidth="1.5" strokeLinejoin="round" />
      )}
      {dMax !== dMin && (
        <>
          <circle cx={x(iHi)} cy={y(dHi)} r="4" fill="#8fd18a" />
          <text x={peakX} y={y(dHi) - 8} textAnchor="middle" fontSize="10" fill="#8fd18a">{peakText}</text>
          <circle cx={x(iLo)} cy={y(dLo)} r="3.5" fill="#d9534f" />
          <text x={Math.min(Math.max(x(iLo), 24), XR - 24)} y={LOW_Y} textAnchor="middle" fontSize="10" fill="#d9534f">{invert ? "Worst" : "Low"} {format(dLo)}</text>
        </>
      )}
      {ticks.map((t) => (
        <text key={t.index} x={t.x} y={TICK_Y} textAnchor={t.anchor} fontSize="10" fill="#7d8c83">{t.text}</text>
      ))}
    </svg>
  );
}
