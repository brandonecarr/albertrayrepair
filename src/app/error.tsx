"use client";

import Link from "next/link";
import { useEffect } from "react";
import { site } from "@/lib/site-config";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[site] render error:", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "4rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: "32rem" }}>
        <p
          style={{
            fontFamily: "var(--font-condensed)",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "var(--orange)",
            fontSize: "0.8rem",
            marginBottom: "0.75rem",
          }}
        >
          Something broke
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 6vw, 3rem)", marginBottom: "1rem" }}>
          We hit a snag
        </h1>
        <p style={{ color: "var(--ink-3)", marginBottom: "2rem" }}>
          Sorry about that. Try again, or call {site.phoneDisplay} and
          we&rsquo;ll take care of you directly.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn btn--ghost">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
