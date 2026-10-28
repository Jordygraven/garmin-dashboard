import type { Point } from "./plateau";

export type Days = 30 | 90;
export type Bar = { day: string; charged: number; drained: number; net: number };

const DAY = 86_400_000;
const ms = (d: string) => Date.parse(d + "T00:00:00Z");

/** The last `days` calendar days, ending at the latest point. */
export function windowPoints(points: Point[], days: Days): Point[] {
  if (!points.length) return [];
  const from = ms(points[points.length - 1].day) - (days - 1) * DAY;
  return points.filter((p) => ms(p.day) >= from);
}

/** Trailing average over the points that fall in the 7 calendar days up to each point. */
export function movingAvg(points: Point[], days = 7): Point[] {
  return points.map((p) => {
    const w = points.filter((q) => ms(q.day) <= ms(p.day) && ms(q.day) > ms(p.day) - days * DAY);
    return { day: p.day, value: w.reduce((a, q) => a + q.value, 0) / w.length };
  });
}

/** One bar per day: charged above the axis, drained below. A missing side counts as 0. */
export function bodyBatteryBars(charged: Point[], drained: Point[]): Bar[] {
  const c = new Map(charged.map((p) => [p.day, p.value]));
  const d = new Map(drained.map((p) => [p.day, p.value]));
  return [...new Set([...c.keys(), ...d.keys()])].sort().map((day) => {
    const up = c.get(day) ?? 0, down = d.get(day) ?? 0;
    return { day, charged: up, drained: down, net: up - down };
  });
}

/** Bar geometry relative to the zero line: positive net goes up (green), negative down (red). */
export function netBarGeom(net: number, max: number, half: number) {
  const height = Math.abs(net) / (max || 1) * half;
  return net >= 0 ? { top: -height, height, color: "#2f8f5b" } : { top: 0, height, color: "#d9534f" };
}

export function barAverages(bars: Bar[]) {
  const mean = (f: (b: Bar) => number) => (bars.length ? bars.reduce((a, b) => a + f(b), 0) / bars.length : 0);
  return { charged: mean((b) => b.charged), drained: mean((b) => b.drained) };
}
