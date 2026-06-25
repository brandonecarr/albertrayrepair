"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary that replaces the root layout when it (or something it
 * renders) throws. It must render its own <html>/<body>, and can't assume the
 * app stylesheet loaded — so everything here is inline and self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[site] fatal error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#17191f",
          color: "#f4efe4",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "30rem" }}>
          <p style={{ color: "#f26a1f", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "0.8rem" }}>
            Something broke
          </p>
          <h1 style={{ fontSize: "2rem", margin: "0.5rem 0 1rem" }}>We hit a snag</h1>
          <p style={{ color: "#c3cbd5", marginBottom: "2rem" }}>
            Sorry about that. Please reload the page, or call (909) 471-0834.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#f26a1f",
              color: "#17191f",
              border: "none",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
