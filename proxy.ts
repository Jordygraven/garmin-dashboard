import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifyToken } from "@/lib/session";

export function proxy(req: NextRequest) {
  if (verifyToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  // /login, /api/login and the cron (own bearer auth) stay public
  matcher: ["/((?!login|api/login|api/cron_garmin|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest).*)"],
};
