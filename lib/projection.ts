import { shortDay } from "./format";
import type { Point } from "./plateau";

export const MIN_POINTS = 14;
export const WINDOW_DAYS = 28;

export type Projection =
  | { state: "short" }
  | { state: "flat" }
  | { state: "far"; due: string }
  | { state: "reaches"; date: string };

const DAY = 86_400_000;
const ms = (d: string) => Date.parse(d + "T00:00:00Z");

/** Straight line through the predictions of the last 28 days; when it crosses `target` (seconds). Later than `due` (YYYY-MM-DD) counts as not reached. */
export function projectGoal(points: Point[], target = 5400, due?: string): Projection {
  if (!points.length) return { state: "short" };
  const lastMs = ms(points[points.length - 1].day);
  const w = points.filter((p) => ms(p.day) > lastMs - WINDOW_DAYS * DAY);
  if (w.length < MIN_POINTS) return { state: "short" };
  const x0 = ms(w[0].day);
  const xs = w.map((p) => (ms(p.day) - x0) / DAY), ys = w.map((p) => p.value);
  const mx = xs.reduce((a, v) => a + v, 0) / w.length, my = ys.reduce((a, v) => a + v, 0) / w.length;
  const sxx = xs.reduce((a, v) => a + (v - mx) ** 2, 0);
  if (sxx === 0) return { state: "flat" };
  const slope = xs.reduce((a, v, i) => a + (v - mx) * (ys[i] - my), 0) / sxx;
  if (slope > -1e-9) return { state: "flat" };
  const xLast = xs[xs.length - 1];
  const xHit = Math.max(xLast, mx + (target - my) / slope); // already under target: today
  const date = new Date(x0 + Math.ceil(xHit) * DAY).toISOString().slice(0, 10);
  return due && date > due ? { state: "far", due } : { state: "reaches", date };
}

export function projectionText(p: Projection): string {
  switch (p.state) {
    case "short": return "Not enough history yet";
    case "flat": return "No improvement trend yet";
    case "far": return `On this trend: not sub 1:30 by ${shortDay(p.due)} ${p.due.slice(0, 4)}`;
    case "reaches": return `On this trend: sub 1:30 by ${shortDay(p.date)}`;
  }
}
