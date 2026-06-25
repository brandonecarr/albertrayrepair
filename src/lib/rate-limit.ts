/**
 * Best-effort in-memory rate limiter for public POST routes.
 *
 * NOTE: state is per-server-instance, so on serverless this limits per
 * warm instance rather than globally — enough to blunt casual abuse and
 * pair with the form honeypot. Swap for Upstash/Redis if you later need
 * strict, cross-instance limits.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();

  // Occasional sweep so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/**
 * Best-available client IP. Prefer headers the hosting platform sets itself
 * (Vercel's `x-real-ip` / `x-vercel-forwarded-for`), which a client can't
 * spoof, over the leftmost token of `x-forwarded-for` (attacker-controlled and
 * trivially rotated to bypass per-IP limits). Falls back to XFF only if the
 * platform headers are absent (e.g. local dev).
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();

  return "unknown";
}

/**
 * Reject obviously oversized request bodies before parsing them. Uses the
 * declared Content-Length (cheap, no buffering). Paired with the per-field
 * caps in validation schemas — this just stops a multi-MB payload from being
 * read into memory at all. Returns true if the request should be rejected.
 */
export function bodyTooLarge(req: Request, maxBytes = 16_384): boolean {
  const len = req.headers.get("content-length");
  if (!len) return false;
  const n = Number(len);
  return Number.isFinite(n) && n > maxBytes;
}
