import type { Point } from "./plateau";

export const DROP_THRESHOLD = -0.1;

/** Fractional change of the latest value vs the latest point at least `days` earlier. */
export function changeOver(points: Point[], days = 14): number | null {
  if (!points.length) return null;
  const last = points[points.length - 1];
  const cutoff = Date.parse(last.day + "T00:00:00Z") - days * 86_400_000;
  const past = [...points].reverse().find((p) => Date.parse(p.day + "T00:00:00Z") <= cutoff);
  if (!past || !past.value) return null;
  return (last.value - past.value) / past.value;
}

export type DropCheck =
  | { state: "warning"; text: string }
  | { state: "ok"; text: string; up: boolean }
  | { state: "none"; text: string };

export function dropCheck(alert: { message: string } | null, change: number | null): DropCheck {
  if (alert) return { state: "warning", text: alert.message };
  if (change === null) return { state: "none", text: "Not enough history yet." };
  const pct = Math.round(Math.abs(change) * 100);
  const up = change >= 0;
  return { state: "ok", up, text: `No drop. Fitness is ${up ? "up" : "down"} ${pct}%.` };
}
