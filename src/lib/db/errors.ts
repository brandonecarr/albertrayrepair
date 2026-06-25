/**
 * Detect a Postgres unique-constraint violation (SQLSTATE 23505).
 *
 * Drizzle's neon-http driver wraps the driver error: the top-level message is
 * just "Failed query: …" and the Postgres code lives on `err.cause` (the
 * underlying NeonDbError). Walk the cause chain so we catch it whether the
 * error is wrapped or raw.
 */
export function isUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let node: unknown = err;
  while (node && typeof node === "object" && !seen.has(node)) {
    seen.add(node);
    const e = node as {
      code?: string;
      message?: string;
      cause?: unknown;
      sourceError?: unknown;
    };
    if (e.code === "23505") return true;
    if (e.message && /duplicate key|unique constraint/i.test(e.message)) return true;
    node = e.cause ?? e.sourceError;
  }
  return false;
}
