import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy.
 *
 * Allows only the external origins the app actually uses: OpenStreetMap tiles
 * (map images), and Photon + OSRM (geocoding/routing fetches on the admin route
 * planner). `'unsafe-inline'` is required for Next's injected bootstrap script
 * and the inline `style` attributes used for chart bars; everything else is
 * locked to same-origin. In development we additionally allow `'unsafe-eval'`
 * and websocket connections so Turbopack/HMR keeps working.
 */
const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'self'`,
  `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.openstreetmap.org`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self' data:`,
  `connect-src 'self' https://photon.komoot.io https://router.project-osrm.org https://*.tile.openstreetmap.org${isDev ? " ws: http://localhost:*" : ""}`,
  `form-action 'self'`,
  `frame-src 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
