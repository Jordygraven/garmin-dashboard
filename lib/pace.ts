export const HALF_KM = 21.0975;

/** Pace per km as m:ss, rounded to the nearest second. */
export function paceLabel(seconds: number, km = HALF_KM): string {
  const s = Math.round(seconds / km);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
}
