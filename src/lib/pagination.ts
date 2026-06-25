/**
 * Keyset (cursor) pagination shared by the admin list reads.
 *
 * Keyset, not OFFSET: paging on `(created_at, id) < (cursor)` keeps every page
 * O(page size) no matter how deep, where OFFSET re-scans all skipped rows. The
 * composite `(created_at, id)` indexes serve both the order and the predicate.
 */
export type Cursor = { createdAt: string; id: string };
export type Page<T> = { items: T[]; nextCursor: Cursor | null };

export const DEFAULT_PAGE_SIZE = 100;

export function clampLimit(n: number | undefined, max = 200): number {
  if (!n || !Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), max);
}

/** Read a `before` cursor from request query params (?beforeAt=&beforeId=). */
export function cursorFromParams(sp: URLSearchParams): Cursor | undefined {
  const at = sp.get("beforeAt");
  const id = sp.get("beforeId");
  return at && id ? { createdAt: at, id } : undefined;
}
