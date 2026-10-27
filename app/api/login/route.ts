import { NextRequest, NextResponse } from "next/server";
import { COOKIE, MAX_AGE, makeToken, safeEqual } from "@/lib/session";

// best-effort throttle; per serverless instance only
const fails = new Map<string, { n: number; until: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const f = fails.get(ip);
  if (f && f.n >= 5 && f.until > Date.now()) {
    return NextResponse.json({ error: "too many attempts" }, { status: 429 });
  }
  const { password } = await req.json().catch(() => ({ password: "" }));
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || typeof password !== "string" || !safeEqual(password, expected)) {
    fails.set(ip, { n: (f?.n ?? 0) + 1, until: Date.now() + 15 * 60_000 });
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
  return res;
}
