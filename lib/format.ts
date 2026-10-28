const TZ = "Asia/Kuala_Lumpur";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const dash = (v: number | null | undefined) => (v === null || v === undefined ? "–" : String(Math.round(Number(v))));

export function hms(sec: number) {
  const s = Math.round(Math.abs(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(2, "0"), rr = String(r).padStart(2, "0");
  return h ? `${h}:${mm}:${rr}` : `${m}:${rr}`;
}

export function shortDay(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function todayHeader(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" })
    .format(now).replace(",", "");
}

export function clock(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function syncedLabel(d: Date | null, now = new Date()) {
  if (!d) return "Never synced";
  const ymd = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(x);
  return ymd(d) === ymd(now) ? `Synced ${clock(d)}` : `Synced ${shortDay(ymd(d))} ${clock(d)}`;
}
