import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

// Session-gated by proxy.ts; adds CRON_SECRET server-side so the browser never sees it.
export async function POST(req: NextRequest) {
  const url = new URL("/api/cron_garmin?manual=1", req.url);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, cache: "no-store" });
  return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : 502 });
}
