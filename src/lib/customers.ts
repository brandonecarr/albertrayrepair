/**
 * Customer persistence + dedupe.
 *
 * A customer is created lazily the first time a lead arrives, matched on a
 * normalized phone (preferred) or email so repeat callers collapse into one
 * record instead of spawning duplicates. All functions no-op gracefully when
 * the DB is not configured, mirroring the rest of the data layer.
 */
import { desc, eq, or } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import {
  customers,
  leads,
  jobs,
  quotes,
  payments,
  type Customer,
} from "./db/schema";

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

  try {
    // Match on either key.
    if (phoneKey || emailKey) {
      const conds = [];
      if (phoneKey) conds.push(eq(customers.phoneKey, phoneKey));
      if (emailKey) conds.push(eq(customers.emailKey, emailKey));
      const existing = await db
        .select()
        .from(customers)
        .where(conds.length === 1 ? conds[0] : or(...conds))
        .limit(1);

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

  try {
    if (phoneKey || emailKey) {
      const conds = [];
      if (phoneKey) conds.push(eq(customers.phoneKey, phoneKey));
      if (emailKey) conds.push(eq(customers.emailKey, emailKey));
      const existing = await db
        .select({ id: customers.id })
        .from(customers)
        .where(conds.length === 1 ? conds[0] : or(...conds))
        .limit(1);
      if (existing[0]) return { ok: true, id: existing[0].id, existed: true };
    }

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
    console.error("[db] createCustomer failed:", err);
    return { ok: false, reason: "error" };
  }
}

/** All customers, newest first. Empty when the DB isn't configured. */
export async function listCustomers(): Promise<AdminCustomer[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(customers)
      .orderBy(desc(customers.createdAt));
    return rows.map(toAdminCustomer);
  } catch (err) {
    console.error("[db] failed to list customers:", err);
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
 * single `db.batch([...])` (one server-side transaction). The duplicate is
 * deleted LAST so the primary can safely adopt its unique phone/email keys.
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
      db.update(customers).set(set).where(eq(customers.id, primaryId)),
      db.delete(customers).where(eq(customers.id, duplicateId)),
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
