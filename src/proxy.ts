import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isAuthConfigured, verifySessionToken } from "@/lib/auth";

/**
 * Protects the admin area. Runs on the edge.
 *
 * - Login routes (page + API) are always public so the admin can sign in.
 * - When auth is NOT configured:
 *     · in development, requests pass through so the admin pages can render
 *       their "not configured" setup notice (convenience while wiring up);
 *     · in PRODUCTION we FAIL CLOSED — a missing ADMIN_PASSWORD/AUTH_SECRET is
 *       a misconfiguration, not an invitation to expose the CRM. Pages get the
 *       login screen, /api/admin/* gets 503. This prevents the entire customer
 *       database from being public if a deploy forgets the env vars.
 * - When auth IS configured, an invalid/absent session redirects pages to the
 *   login screen and returns 401 JSON for /api/admin/* calls.
 */
/**
 * Forward the resolved pathname to server components so the admin layout can
 * independently re-verify the session (defense in depth — a matcher gap or
 * future refactor can't silently expose data if the layout also checks).
 */
function passThrough(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-ar-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === "/admin/login";
  const isLoginApi = pathname === "/api/admin/login";
  if (isLoginPage || isLoginApi) return passThrough(req);

  // Auth not configured. In dev, let the setup notice render. In production,
  // fail closed — never serve admin data without credentials in place.
  if (!isAuthConfigured) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Admin authentication is not configured on this deployment." },
        { status: 503 }
      );
    }
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySessionToken(token);
  if (valid) return passThrough(req);

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
