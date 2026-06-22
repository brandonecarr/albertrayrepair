import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isAuthConfigured, verifySessionToken } from "@/lib/auth";

/**
 * Protects the admin area. Runs on the edge.
 *
 * - Login routes (page + API) are always public so the admin can sign in.
 * - When auth is NOT configured, requests pass through so the admin pages can
 *   render their "not configured" setup notice.
 * - When auth IS configured, an invalid/absent session redirects pages to the
 *   login screen and returns 401 JSON for /api/admin/* calls.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === "/admin/login";
  const isLoginApi = pathname === "/api/admin/login";
  if (isLoginPage || isLoginApi) return NextResponse.next();

  // Nothing to protect until the admin credentials exist.
  if (!isAuthConfigured) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySessionToken(token);
  if (valid) return NextResponse.next();

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
