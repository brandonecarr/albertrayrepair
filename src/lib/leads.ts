/**
 * Lead persistence. Writes every booking / contact submission to the
 * `leads` table. No-ops gracefully (logs only) when the DB is not yet
 * configured, so submissions never throw and notifications still fire.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { leads, type NewLead, type LeadStatus } from "./db/schema";
import { findOrCreateCustomer } from "./customers";
import { clampLimit, type Cursor, type Page } from "./pagination";
import type { BookingInput, ContactInput } from "./validation";

/**
 * Plain, JSON-safe shape passed from server components to the admin client UI.
 * (Dates become ISO strings; the raw `payload` is dropped from the list.)
 */
export type AdminLead = {
  id: string;
  type: "booking" | "contact";
  status: LeadStatus;
  customerId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  address: string | null;
  message: string | null;
  createdAt: string;
  readAt: string | null;
};

/** Persists a booking lead. Returns the new lead id (or null) so the caller
 *  can link it to the reserved booking row. */
export async function saveBookingLead(b: BookingInput): Promise<string | null> {
  if (!isDbConfigured || !db) {
    console.info("[db] not configured — booking lead not persisted (set DATABASE_URL to enable)");
    return null;
  }
  try {
    const customerId = await findOrCreateCustomer({
      name: b.name,
      phone: b.phone,
      email: b.email || null,
      address: b.address,
    });
    const row: NewLead = {
      type: "booking",
      customerId,
      name: b.name,
      phone: b.phone,
      email: b.email || null,
      service: b.service,
      preferredDate: b.date,
      preferredTime: b.time,
      address: b.address,
      message: b.notes || null,
      payload: b,
    };
    const inserted = await db.insert(leads).values(row).returning({ id: leads.id });
    return inserted[0]?.id ?? null;
  } catch (err) {
    console.error("[db] failed to persist booking lead:", err);
    return null;
  }
}

export async function saveContactLead(c: ContactInput): Promise<void> {
  if (!isDbConfigured || !db) {
    console.info("[db] not configured — contact lead not persisted (set DATABASE_URL to enable)");
    return;
  }
  try {
    const looksEmail = c.contact.includes("@");
    const phone = looksEmail ? null : c.contact;
    const email = looksEmail ? c.contact : null;
    const customerId = await findOrCreateCustomer({
      name: c.name,
      phone,
      email,
    });
    const row: NewLead = {
      type: "contact",
      customerId,
      name: c.name,
      phone,
      email,
      message: c.message,
      payload: c,
    };
    await db.insert(leads).values(row);
  } catch (err) {
    console.error("[db] failed to persist contact lead:", err);
  }
}

// ─── Admin reads/writes ──────────────────────────────────────────────────

type LeadRow = typeof leads.$inferSelect;

function toAdminLead(r: LeadRow): AdminLead {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    customerId: r.customerId,
    name: r.name,
    phone: r.phone,
    email: r.email,
    service: r.service,
    preferredDate: r.preferredDate,
    preferredTime: r.preferredTime,
    address: r.address,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt ? r.readAt.toISOString() : null,
  };
}

/** A page of leads, newest first (keyset paginated). */
export async function listLeads(
  opts: { limit?: number; before?: Cursor } = {}
): Promise<Page<AdminLead>> {
  if (!isDbConfigured || !db) return { items: [], nextCursor: null };
  const limit = clampLimit(opts.limit);
  try {
    const where = opts.before
      ? sql`(${leads.createdAt}, ${leads.id}) < (${new Date(opts.before.createdAt)}, ${opts.before.id})`
      : undefined;
    const rows = await db
      .select()
      .from(leads)
      .where(where)
      .orderBy(desc(leads.createdAt), desc(leads.id))
      .limit(limit + 1); // +1 to detect whether more rows exist
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toAdminLead);
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  } catch (err) {
    console.error("[db] failed to list leads:", err);
    return { items: [], nextCursor: null };
  }
}

/** The N newest leads — for the dashboard, without loading the whole table. */
export async function listRecentLeads(limit = 6): Promise<AdminLead[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt))
      .limit(limit);
    return rows.map(toAdminLead);
  } catch (err) {
    console.error("[db] failed to list recent leads:", err);
    return [];
  }
}

/** A single lead by id, or null. */
export async function getLeadById(id: string): Promise<AdminLead | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const rows = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return rows[0] ? toAdminLead(rows[0]) : null;
  } catch (err) {
    console.error("[db] failed to get lead:", err);
    return null;
  }
}

/** Leads tied to one customer, newest first. */
export async function listLeadsForCustomer(
  customerId: string
): Promise<AdminLead[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(leads)
      .where(eq(leads.customerId, customerId))
      .orderBy(desc(leads.createdAt));
    return rows.map(toAdminLead);
  } catch (err) {
    console.error("[db] failed to list customer leads:", err);
    return [];
  }
}

/** Move a lead to a different customer (manual relink). */
export async function reassignLead(
  leadId: string,
  customerId: string
): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    await db.update(leads).set({ customerId }).where(eq(leads.id, leadId));
    return true;
  } catch (err) {
    console.error("[db] failed to reassign lead:", err);
    return false;
  }
}

/** Update a lead's pipeline status. No-op when the DB isn't configured. */
export async function setLeadStatus(id: string, status: LeadStatus): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    await db.update(leads).set({ status }).where(eq(leads.id, id));
    return true;
  } catch (err) {
    console.error("[db] failed to update lead status:", err);
    return false;
  }
}

/** Stamp a lead as read (opened in the inbox). */
export async function markLeadRead(id: string): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    await db.update(leads).set({ readAt: new Date() }).where(eq(leads.id, id));
    return true;
  } catch (err) {
    console.error("[db] failed to mark lead read:", err);
    return false;
  }
}
