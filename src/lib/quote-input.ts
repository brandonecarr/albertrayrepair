/** Shared request parsing for quote API routes (create + update). */
import type { QuoteLineInput } from "./quotes";
import { parseMoney } from "./money";

/**
 * Parse a raw `lineItems` array into priced QuoteLineInputs.
 * Each item: { description, quantity, unitDollars }. Returns null on bad input.
 */
export function parseLineItems(raw: unknown): QuoteLineInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: QuoteLineInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const description = typeof r.description === "string" ? r.description.trim() : "";
    if (!description) return null;
    const quantity = parseMoney(r.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    const unit = parseMoney(r.unitDollars);
    if (!Number.isFinite(unit) || unit < 0) return null;
    out.push({ description, quantity, unitAmountCents: Math.round(unit * 100) });
  }
  return out;
}

/** Dollars → integer cents. undefined passes through; invalid returns NaN. */
export function dollarsToCents(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = parseMoney(v);
  if (!Number.isFinite(n) || n < 0) return NaN; // signal invalid
  return Math.round(n * 100);
}
