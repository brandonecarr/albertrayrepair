"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/availability", label: "Availability" },
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
      <Link href="/admin" className="adminBrand" aria-label="Albert Ray — Dashboard">
        <Image
          src="/brand/logo.png"
          alt="Albert Ray"
          width={1200}
          height={805}
          className="adminBrandLogo"
          priority
        />
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
