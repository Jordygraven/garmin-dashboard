/** Percent of the way from the first prediction to the target, clamped to 0-100. Start at or under target is 100. */
export function progressPct(start: number, current: number, target: number): number {
  if (start <= target) return 100;
  return Math.min(100, Math.max(0, ((start - current) / (start - target)) * 100));
}
