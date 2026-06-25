import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  isAuthConfigured,
  passwordMatches,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { rateLimit, clientIp, bodyTooLarge } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (bodyTooLarge(req, 4_096)) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  if (!isAuthConfigured) {
    return NextResponse.json(
      { error: "Admin is not configured. Set ADMIN_PASSWORD and AUTH_SECRET." },
      { status: 503 }
    );
  }

  // Tighter limiter on the login route to slow brute-force attempts.
  if (!rateLimit(`admin-login:${clientIp(req)}`, 8, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
