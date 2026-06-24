"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site-config";
import LogoutButton from "./LogoutButton";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/notifications", label: "Notifications" },
];

function currentLabel(path: string): string {
  const match = NAV.find((n) =>
    n.href === "/admin" ? path === "/admin" : path.startsWith(n.href)
  );
  return match?.label ?? "Ops";
}

export default function AdminTopBar() {
  const path = usePathname();
  return (
    <header className="adminBar">
      <Link href="/admin" className="adminBrand" aria-label={`${site.name} — Dashboard`}>
        <span className="adminBrandName">{site.name}</span>
        <span className="adminBrandTag">{currentLabel(path)}</span>
      </Link>

      <nav className="adminNav">
        {NAV.map((n) => {
          const active =
            n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`adminNavLink ${active ? "adminNavActive" : ""}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="adminBarRight">
        <LogoutButton />
      </div>
    </header>
  );
}
