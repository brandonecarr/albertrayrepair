import Link from "next/link";
import { site } from "@/lib/site-config";

export default function NotFound() {
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
          Error 404
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 6vw, 3rem)", marginBottom: "1rem" }}>
          Page not found
        </h1>
        <p style={{ color: "var(--ink-3)", marginBottom: "2rem" }}>
          That page doesn&rsquo;t exist. Let&rsquo;s get you back on track — or
          call {site.phoneDisplay} and we&rsquo;ll help directly.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" className="btn">
            Back home
          </Link>
          <a href={site.phoneHref} className="btn btn--ghost">
            Call {site.phoneDisplay}
          </a>
        </div>
      </div>
    </main>
  );
}
