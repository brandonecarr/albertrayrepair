/**
 * Customer persistence + dedupe.
 *
 * A customer is created lazily the first time a lead arrives, matched on a
 * normalized phone (preferred) or email so repeat callers collapse into one
 * record instead of spawning duplicates. All functions no-op gracefully when
 * the DB is not configured, mirroring the rest of the data layer.
 */
import { and, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { isUniqueViolation } from "./db/errors";
import { clampLimit, type Cursor, type Page } from "./pagination";
import {
  customers,
  leads,
  jobs,
  quotes,
  payments,
  type Customer,
} from "./db/schema";

/** Build the OR-condition that matches a customer by phone or email key. */
function keyMatch(phoneKey: string | null, emailKey: string | null): SQL | undefined {
  const conds: SQL[] = [];
  if (phoneKey) conds.push(eq(customers.phoneKey, phoneKey));
  if (emailKey) conds.push(eq(customers.emailKey, emailKey));
  if (conds.length === 0) return undefined;
  return conds.length === 1 ? conds[0] : or(...conds);
}

/** Digits-only phone key (last 10 digits) for dedupe. Null if too short. */
export function phoneKeyOf(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

/** Lowercased, trimmed email key for dedupe. Null if it doesn't look like one. */
export function emailKeyOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e.includes("@") ? e : null;
}

/** Plain, JSON-safe shape passed to admin client components. */
export type AdminCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function toAdminCustomer(c: Customer): AdminCustomer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

type UpsertInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

/**
 * Find an existing customer by phone/email key, or create one. Returns the
 * customer id, or null when the DB isn't configured. Best-effort: fills in
 * missing contact fields on an existing match but never overwrites good data.
 */
export async function findOrCreateCustomer(
  input: UpsertInput
): Promise<string | null> {
  if (!isDbConfigured || !db) return null;

  const phoneKey = phoneKeyOf(input.phone);
  const emailKey = emailKeyOf(input.email);

  const match = keyMatch(phoneKey, emailKey);

  try {
    // Match on either key.
    if (match) {
      const existing = await db.select().from(customers).where(match).limit(1);

      if (existing[0]) {
        const c = existing[0];
        // Backfill any contact detail we now know but didn't have before.
        const patch: Partial<typeof customers.$inferInsert> = {};
        if (!c.phone && input.phone) {
          patch.phone = input.phone;
          patch.phoneKey = phoneKey;
        }
        if (!c.email && input.email) {
          patch.email = input.email;
          patch.emailKey = emailKey;
        }
        if (!c.address && input.address) patch.address = input.address;
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = new Date();
          await db.update(customers).set(patch).where(eq(customers.id, c.id));
        }
        return c.id;
      }
    }

    try {
      const inserted = await db
        .insert(customers)
        .values({
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          phoneKey,
          emailKey,
        })
        .returning({ id: customers.id });
      return inserted[0]?.id ?? null;
    } catch (err) {
      // Concurrent first-time submission from the same person: the partial
      // unique index rejected our insert. Re-select the row the winner created
      // instead of failing (which would otherwise lose the lead).
      if (isUniqueViolation(err) && match) {
        const raced = await db
          .select({ id: customers.id })
          .from(customers)
          .where(match)
          .limit(1);
        if (raced[0]) return raced[0].id;
      }
      throw err;
    }
  } catch (err) {
    console.error("[db] findOrCreateCustomer failed:", err);
    return null;
  }
}

export type CreateCustomerResult =
  | { ok: true; id: string; existed: boolean }
  | { ok: false; reason: "db_unconfigured" | "error" };

/**
 * Manually add a customer (a phone-call or walk-in, not from the web form).
 * Honors the same phone/email dedupe — if a match exists, returns it rather
 * than creating a duplicate.
 */
export async function createCustomer(input: {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<CreateCustomerResult> {
  if (!isDbConfigured || !db) return { ok: false, reason: "db_unconfigured" };

  const phoneKey = phoneKeyOf(input.phone);
  const emailKey = emailKeyOf(input.email);

  const match = keyMatch(phoneKey, emailKey);

  try {
    if (match) {
      const existing = await db
        .select({ id: customers.id })
        .from(customers)
        .where(match)
        .limit(1);
      if (existing[0]) return { ok: true, id: existing[0].id, existed: true };
    }

    try {
      const inserted = await db
        .insert(customers)
        .values({
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
          phoneKey,
          emailKey,
        })
        .returning({ id: customers.id });
      const id = inserted[0]?.id;
      if (!id) return { ok: false, reason: "error" };
      return { ok: true, id, existed: false };
    } catch (err) {
      // Lost a race to a concurrent insert with the same phone/email — adopt it.
      if (isUniqueViolation(err) && match) {
        const raced = await db
          .select({ id: customers.id })
          .from(customers)
          .where(match)
          .limit(1);
        if (raced[0]) return { ok: true, id: raced[0].id, existed: true };
      }
      throw err;
    }
  } catch (err) {
    console.error("[db] createCustomer failed:", err);
    return { ok: false, reason: "error" };
  }
}

/** A page of customers, newest first (keyset paginated). */
export async function listCustomers(
  opts: { limit?: number; before?: Cursor } = {}
): Promise<Page<AdminCustomer>> {
  if (!isDbConfigured || !db) return { items: [], nextCursor: null };
  const limit = clampLimit(opts.limit);
  try {
    const where = opts.before
      ? sql`(${customers.createdAt}, ${customers.id}) < (${new Date(opts.before.createdAt)}, ${opts.before.id})`
      : undefined;
    const rows = await db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toAdminCustomer);
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  } catch (err) {
    console.error("[db] failed to list customers:", err);
    return { items: [], nextCursor: null };
  }
}

/** Lightweight customer shape for pickers (merge / reassign). */
export type CustomerLite = { id: string; name: string; phone: string | null; email: string | null };

/**
 * Search customers by name/phone/email for on-demand pickers, capped by LIMIT
 * so it never loads the whole table. Backed by trigram indexes for the ILIKE.
 */
export async function searchCustomers(
  query: string,
  opts: { excludeId?: string; limit?: number } = {}
): Promise<CustomerLite[]> {
  if (!isDbConfigured || !db) return [];
  const limit = Math.min(opts.limit ?? 8, 25);
  const q = query.trim();
  try {
    const conds: SQL[] = [];
    if (opts.excludeId) conds.push(ne(customers.id, opts.excludeId));
    if (q) {
      const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
      const match = or(
        ilike(customers.name, like),
        ilike(customers.phone, like),
        ilike(customers.email, like)
      );
      if (match) conds.push(match);
    }
    const where =
      conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const rows = await db
      .select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email })
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(limit);
    return rows;
  } catch (err) {
    console.error("[db] failed to search customers:", err);
    return [];
  }
}

/** A single customer by id, or null. */
export async function getCustomer(id: string): Promise<AdminCustomer | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    return rows[0] ? toAdminCustomer(rows[0]) : null;
  } catch (err) {
    console.error("[db] failed to get customer:", err);
    return null;
  }
}

type CustomerPatch = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type MergeResult =
  | { ok: true }
  | { ok: false; reason: "same" | "not_found" | "db_unconfigured" | "error" };

/**
 * Merge a duplicate customer into a primary one: reassign all leads, jobs,
 * quotes, and payments, backfill any contact fields the primary is missing,
 * then delete the duplicate — all atomically.
 *
 * The Neon HTTP driver has no interactive transactions, so this runs as a
 * single `db.batch([...])` (one server-side transaction). Ordering matters:
 * reassign children FIRST (so deleting the duplicate can't cascade them away),
 * then DELETE the duplicate to free its unique phone/email keys, and only THEN
 * update the primary to adopt those keys — otherwise the primary update would
 * collide with the still-present duplicate on the partial unique index (23505).
 */
export async function mergeCustomers(
  primaryId: string,
  duplicateId: string
): Promise<MergeResult> {
  if (!isDbConfigured || !db) return { ok: false, reason: "db_unconfigured" };
  if (primaryId === duplicateId) return { ok: false, reason: "same" };

  try {
    const rows = await db
      .select()
      .from(customers)
      .where(or(eq(customers.id, primaryId), eq(customers.id, duplicateId)));
    const primary = rows.find((r) => r.id === primaryId);
    const dup = rows.find((r) => r.id === duplicateId);
    if (!primary || !dup) return { ok: false, reason: "not_found" };

    // Backfill only what the primary is missing (never overwrite good data).
    const set: Partial<typeof customers.$inferInsert> = { updatedAt: new Date() };
    if (!primary.phone && dup.phone) {
      set.phone = dup.phone;
      set.phoneKey = dup.phoneKey;
    }
    if (!primary.email && dup.email) {
      set.email = dup.email;
      set.emailKey = dup.emailKey;
    }
    if (!primary.address && dup.address) set.address = dup.address;
    if (!primary.notes && dup.notes) set.notes = dup.notes;

    await db.batch([
      db.update(leads).set({ customerId: primaryId }).where(eq(leads.customerId, duplicateId)),
      db.update(jobs).set({ customerId: primaryId }).where(eq(jobs.customerId, duplicateId)),
      db.update(quotes).set({ customerId: primaryId }).where(eq(quotes.customerId, duplicateId)),
      db.update(payments).set({ customerId: primaryId }).where(eq(payments.customerId, duplicateId)),
      // Delete BEFORE the key-adopting update so the unique keys are free.
      db.delete(customers).where(eq(customers.id, duplicateId)),
      db.update(customers).set(set).where(eq(customers.id, primaryId)),
    ]);
    return { ok: true };
  } catch (err) {
    console.error("[db] failed to merge customers:", err);
    return { ok: false, reason: "error" };
  }
}

/** Update an existing customer's editable fields. Recomputes dedupe keys. */
export async function updateCustomer(
  id: string,
  patch: CustomerPatch
): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    const set: Partial<typeof customers.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.phone !== undefined) {
      set.phone = patch.phone;
      set.phoneKey = phoneKeyOf(patch.phone);
    }
    if (patch.email !== undefined) {
      set.email = patch.email;
      set.emailKey = emailKeyOf(patch.email);
    }
    if (patch.address !== undefined) set.address = patch.address;
    if (patch.notes !== undefined) set.notes = patch.notes;
    await db.update(customers).set(set).where(eq(customers.id, id));
    return true;
  } catch (err) {
    console.error("[db] failed to update customer:", err);
    return false;
  }
}
