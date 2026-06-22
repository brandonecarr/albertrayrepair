/**
 * Quote persistence — itemized estimates per customer.
 *
 * The Neon HTTP driver has NO interactive transactions, so a quote and its
 * line items are written together with `db.batch([...])` (one server-side
 * transaction). `totalCents` is computed in JS and denormalized onto the quote
 * so listings and the lifetime-spend rollup never re-aggregate line items.
 * All functions no-op gracefully when the DB is unconfigured.
 */
import { randomUUID } from "crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { quotes, quoteLineItems, type QuoteStatus } from "./db/schema";
import { createJob } from "./jobs";

// ─── Types (JSON-safe for the admin UI) ──────────────────────────────────

export type AdminQuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  lineTotalCents: number;
  position: number;
};

export type AdminQuote = {
  id: string;
  number: number;
  customerId: string;
  jobId: string | null;
  status: QuoteStatus;
  title: string;
  notes: string | null;
  taxCents: number | null;
  totalCents: number;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  decidedAt: string | null;
  lineItems: AdminQuoteLineItem[];
};

export type QuoteLineInput = {
  description: string;
  quantity: number;
  unitAmountCents: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Build persisted line rows + the denormalized quote total (incl. tax). */
function priceLines(
  quoteId: string,
  lines: QuoteLineInput[],
  taxCents: number | null
) {
  const rows = lines.map((li, i) => ({
    id: randomUUID(),
    quoteId,
    description: li.description,
    // numeric column — store as string to preserve precision.
    quantity: String(li.quantity),
    unitAmountCents: li.unitAmountCents,
    lineTotalCents: Math.round(li.quantity * li.unitAmountCents),
    position: i,
  }));
  const subtotal = rows.reduce((s, r) => s + r.lineTotalCents, 0);
  return { rows, totalCents: subtotal + (taxCents ?? 0) };
}

function toLineItem(r: typeof quoteLineItems.$inferSelect): AdminQuoteLineItem {
  return {
    id: r.id,
    description: r.description,
    quantity: Number(r.quantity),
    unitAmountCents: r.unitAmountCents,
    lineTotalCents: r.lineTotalCents,
    position: r.position,
  };
}

function toQuote(
  q: typeof quotes.$inferSelect,
  lines: AdminQuoteLineItem[]
): AdminQuote {
  return {
    id: q.id,
    number: q.number,
    customerId: q.customerId,
    jobId: q.jobId,
    status: q.status,
    title: q.title,
    notes: q.notes,
    taxCents: q.taxCents,
    totalCents: q.totalCents,
    validUntil: q.validUntil,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    sentAt: q.sentAt ? q.sentAt.toISOString() : null,
    decidedAt: q.decidedAt ? q.decidedAt.toISOString() : null,
    lineItems: lines,
  };
}

// ─── Create / update ──────────────────────────────────────────────────────

export type CreateQuoteInput = {
  customerId: string;
  title: string;
  notes?: string | null;
  taxCents?: number | null;
  validUntil?: string | null;
  lineItems: QuoteLineInput[];
};

/** Create a quote with its line items. Returns the new id, or null. */
export async function createQuote(input: CreateQuoteInput): Promise<string | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const id = randomUUID();
    const tax = input.taxCents ?? null;
    const { rows, totalCents } = priceLines(id, input.lineItems, tax);
    const quoteRow = {
      id,
      customerId: input.customerId,
      title: input.title,
      notes: input.notes ?? null,
      taxCents: tax,
      totalCents,
      validUntil: input.validUntil ?? null,
    };

    if (rows.length > 0) {
      await db.batch([
        db.insert(quotes).values(quoteRow),
        db.insert(quoteLineItems).values(rows),
      ]);
    } else {
      await db.insert(quotes).values(quoteRow);
    }
    return id;
  } catch (err) {
    console.error("[db] failed to create quote:", err);
    return null;
  }
}

export type UpdateQuoteInput = {
  title?: string;
  notes?: string | null;
  taxCents?: number | null;
  validUntil?: string | null;
  /** When provided, replaces ALL line items (and recomputes the total). */
  lineItems?: QuoteLineInput[];
};

/** Update a quote's fields and (optionally) replace its line items. */
export async function updateQuote(
  id: string,
  patch: UpdateQuoteInput
): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    const set: Partial<typeof quotes.$inferInsert> = { updatedAt: new Date() };
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.notes !== undefined) set.notes = patch.notes;
    if (patch.validUntil !== undefined) set.validUntil = patch.validUntil;
    const tax = patch.taxCents !== undefined ? patch.taxCents : undefined;
    if (tax !== undefined) set.taxCents = tax;

    if (patch.lineItems) {
      const { rows, totalCents } = priceLines(id, patch.lineItems, tax ?? null);
      set.totalCents = totalCents;
      if (rows.length > 0) {
        await db.batch([
          db.update(quotes).set(set).where(eq(quotes.id, id)),
          db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, id)),
          db.insert(quoteLineItems).values(rows),
        ]);
      } else {
        await db.batch([
          db.update(quotes).set(set).where(eq(quotes.id, id)),
          db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, id)),
        ]);
      }
    } else {
      await db.update(quotes).set(set).where(eq(quotes.id, id));
    }
    return true;
  } catch (err) {
    console.error("[db] failed to update quote:", err);
    return false;
  }
}

/** Move a quote's status; stamps sentAt / decidedAt as appropriate. */
export async function setQuoteStatus(
  id: string,
  status: QuoteStatus
): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    const set: Partial<typeof quotes.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };
    if (status === "sent") set.sentAt = new Date();
    if (status === "accepted" || status === "declined") set.decidedAt = new Date();
    await db.update(quotes).set(set).where(eq(quotes.id, id));
    return true;
  } catch (err) {
    console.error("[db] failed to set quote status:", err);
    return false;
  }
}

export type AcceptQuoteResult =
  | { ok: true; jobId: string; alreadyExisted: boolean }
  | { ok: false; reason: "not_found" | "db_unconfigured" | "error" };

/**
 * Accept a quote → create a linked `scheduled` job (idempotent: returns the
 * existing job if the quote was already accepted).
 */
export async function acceptQuote(id: string): Promise<AcceptQuoteResult> {
  if (!isDbConfigured || !db) return { ok: false, reason: "db_unconfigured" };
  try {
    const found = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    const q = found[0];
    if (!q) return { ok: false, reason: "not_found" };

    if (q.jobId) {
      if (q.status !== "accepted") {
        await db
          .update(quotes)
          .set({ status: "accepted", decidedAt: new Date(), updatedAt: new Date() })
          .where(eq(quotes.id, id));
      }
      return { ok: true, jobId: q.jobId, alreadyExisted: true };
    }

    const jobId = await createJob({
      customerId: q.customerId,
      title: q.title,
      status: "scheduled",
      amountCents: q.totalCents,
      quoteId: q.id,
    });
    if (!jobId) return { ok: false, reason: "error" };

    await db
      .update(quotes)
      .set({ jobId, status: "accepted", decidedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, id));
    return { ok: true, jobId, alreadyExisted: false };
  } catch (err) {
    console.error("[db] failed to accept quote:", err);
    return { ok: false, reason: "error" };
  }
}

/** Delete a quote (its line items cascade). */
export async function deleteQuote(id: string): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    await db.delete(quotes).where(eq(quotes.id, id));
    return true;
  } catch (err) {
    console.error("[db] failed to delete quote:", err);
    return false;
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────

/** Quotes for one customer (with line items), newest first. */
export async function listQuotesForCustomer(
  customerId: string
): Promise<AdminQuote[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const qRows = await db
      .select()
      .from(quotes)
      .where(eq(quotes.customerId, customerId))
      .orderBy(desc(quotes.createdAt));
    if (qRows.length === 0) return [];

    const ids = qRows.map((q) => q.id);
    const liRows = await db
      .select()
      .from(quoteLineItems)
      .where(inArray(quoteLineItems.quoteId, ids));

    const byQuote = new Map<string, AdminQuoteLineItem[]>();
    for (const r of liRows) {
      const arr = byQuote.get(r.quoteId) ?? [];
      arr.push(toLineItem(r));
      byQuote.set(r.quoteId, arr);
    }
    for (const arr of byQuote.values()) arr.sort((a, b) => a.position - b.position);

    return qRows.map((q) => toQuote(q, byQuote.get(q.id) ?? []));
  } catch (err) {
    console.error("[db] failed to list quotes:", err);
    return [];
  }
}

/** A single quote with line items, or null. */
export async function getQuote(id: string): Promise<AdminQuote | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const found = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    if (!found[0]) return null;
    const liRows = await db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, id));
    const lines = liRows.map(toLineItem).sort((a, b) => a.position - b.position);
    return toQuote(found[0], lines);
  } catch (err) {
    console.error("[db] failed to get quote:", err);
    return null;
  }
}
