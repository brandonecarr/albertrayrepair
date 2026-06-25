/**
 * Money parsing shared by the API routes and the admin inputs.
 *
 * Money fields in the admin are free-text, so users naturally type "$1,250"
 * or "1,250.00". A bare Number() turns those into NaN and the value is
 * silently rejected. Strip currency formatting first, then parse.
 */

/** Parse a user-entered money string ("$1,250.50") to a number. NaN if empty/invalid. */
export function parseMoney(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return NaN;
  const cleaned = v.replace(/[$,\s]/g, "");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

/** Dollars → integer cents. Returns NaN for invalid/negative input. */
export function dollarsToCentsStrict(v: unknown): number {
  const n = parseMoney(v);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}
