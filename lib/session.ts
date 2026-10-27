import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "gd_session";
export const MAX_AGE = 60 * 60 * 24 * 30;

const sign = (payload: string) =>
  createHmac("sha256", process.env.SESSION_SECRET ?? "").update(payload).digest("base64url");

export function safeEqual(a: string, b: string) {
  const x = createHmac("sha256", "cmp").update(a).digest();
  const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

export function makeToken(now = Date.now()) {
  const exp = String(Math.floor(now / 1000) + MAX_AGE);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token: string | undefined, now = Date.now()) {
  if (!token || !process.env.SESSION_SECRET) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > now / 1000;
}
