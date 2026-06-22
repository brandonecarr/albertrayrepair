"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

/**
 * The center calendar control: a button showing the current scope
 * ("This Week" / "This Month") that opens a small dropdown to switch between
 * the week and month views. Closes on outside-click or Escape.
 */
export default function CalScopeMenu({
  scope,
  weekHref,
  monthHref,
}: {
  scope: "week" | "month";
  weekHref: string;
  monthHref: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = scope === "month" ? "This Month" : "This Week";

  return (
    <div className="calScope" ref={ref}>
      <button
        type="button"
        className="calNavBtn calScopeBtn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
        <svg className="calScopeCaret" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M3 4.5 6 7.5 9 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="calScopeMenu" role="menu">
          <Link
            href={weekHref}
            role="menuitem"
            className={`calScopeItem ${scope === "week" ? "calScopeItemActive" : ""}`}
            onClick={() => setOpen(false)}
          >
            This Week
          </Link>
          <Link
            href={monthHref}
            role="menuitem"
            className={`calScopeItem ${scope === "month" ? "calScopeItemActive" : ""}`}
            onClick={() => setOpen(false)}
          >
            This Month
          </Link>
        </div>
      )}
    </div>
  );
}
