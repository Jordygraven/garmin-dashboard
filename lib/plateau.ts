export type Point = { day: string; value: number };
export type Span = { start: number; end: number }; // inclusive point indexes

export const PLATEAU_DAYS = 5;
export const PLATEAU_PCT = 0.02;

const dayMs = (d: string) => Date.parse(d + "T00:00:00Z");

/** Windows of 5 consecutive days whose (max-min)/max is under 2%, merged into spans. */
export function findPlateaus(points: Point[]): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i + PLATEAU_DAYS <= points.length; i++) {
    const w = points.slice(i, i + PLATEAU_DAYS);
    const consecutive = w.every((p, k) => k === 0 || dayMs(p.day) - dayMs(w[k - 1].day) === 86_400_000);
    if (!consecutive) continue;
    const vals = w.map((p) => p.value);
    const max = Math.max(...vals);
    if (max <= 0 || (max - Math.min(...vals)) / max >= PLATEAU_PCT) continue;
    const end = i + PLATEAU_DAYS - 1;
    const last = spans[spans.length - 1];
    if (last && i <= last.end) last.end = end;
    else spans.push({ start: i, end });
  }
  return spans;
}
