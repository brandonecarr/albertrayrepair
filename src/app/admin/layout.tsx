import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isAuthConfigured, verifySessionToken } from "@/lib/auth";
import "./admin.css";

export const metadata: Metadata = {
  title: "Ops Console",
  robots: { index: false, follow: false },
};

/**
 * Defense in depth: the proxy already gates /admin, but the layout independently
 * verifies the session on every render so a matcher gap can never serve admin
 * data. The login page is exempt (it's how you obtain a session). In production,
 * unconfigured auth fails closed here too.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-ar-pathname") ?? "";
  const isLoginPage = pathname === "/admin/login";

  if (!isLoginPage) {
    if (!isAuthConfigured) {
      if (process.env.NODE_ENV === "production") redirect("/admin/login");
    } else {
      const token = (await cookies()).get(SESSION_COOKIE)?.value;
      if (!(await verifySessionToken(token))) redirect("/admin/login");
    }
  }

  return <div className="admin">{children}</div>;
}
