"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] render error:", error);
  }, [error]);

  return (
    <main className="adminMain">
      <div className="adminEmpty">
        <div>
          <p className="adminEmptyTitle">Something went wrong</p>
          <p>
            This page hit an error
            {error.digest ? ` (ref ${error.digest})` : ""}. Try again, or head
            back to the dashboard.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button type="button" className="reportRangeBtn" onClick={() => reset()}>
              Try again
            </button>
            <Link href="/admin" className="reportRangeBtn">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
