/**
 * Scheduling — availability templates, slot computation, and booking lifecycle.
 *
 * GRACEFUL FALLBACK: when the DB is unconfigured, availability falls back to
 * DEFAULT_AVAILABILITY (the values the public form used to hardcode), there
 * are no blocks or existing bookings, and writes no-op. The public booking
 * form therefore works identically with or without a database.
 */
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { isUniqueViolation } from "./db/errors";
import { weekdayOfIso } from "./timezone";
import {
  availability,
  blockedSlots,
  bookings,
  type BookingStatus,
} from "./db/schema";

// ─── Defaults (mirror the original hardcoded slots) ──────────────────────

const WEEKDAY_SLOTS = [
  "7:30 AM", "9:00 AM", "10:30 AM", "12:00 PM", "1:30 PM", "3:00 PM", "4:30 PM",
];
const SATURDAY_SLOTS = ["8:00 AM", "9:30 AM", "11:00 AM", "12:30 PM"];

export type DayAvailability = { weekday: number; enabled: boolean; slots: string[] };

/** Index 0=Sun … 6=Sat. */
export const DEFAULT_AVAILABILITY: DayAvailability[] = [
  { weekday: 0, enabled: false, slots: [] }, // Sunday — closed
  { weekday: 1, enabled: true, slots: WEEKDAY_SLOTS },
  { weekday: 2, enabled: true, slots: WEEKDAY_SLOTS },
  { weekday: 3, enabled: true, slots: WEEKDAY_SLOTS },
  { weekday: 4, enabled: true, slots: WEEKDAY_SLOTS },
  { weekday: 5, enabled: true, slots: WEEKDAY_SLOTS },
  { weekday: 6, enabled: true, slots: SATURDAY_SLOTS }, // Saturday
];

export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const ACTIVE_STATUSES: BookingStatus[] = ["requested", "confirmed"];

/** Weekday (0-6) for a YYYY-MM-DD string — timezone independent. */
const weekdayOf = weekdayOfIso;

// ─── Availability template ───────────────────────────────────────────────

/** Full weekly template, merging any DB overrides onto the defaults. */
export async function getWeeklyAvailability(): Promise<DayAvailability[]> {
  if (!isDbConfigured || !db) return DEFAULT_AVAILABILITY.map((d) => ({ ...d }));
  try {
    const rows = await db.select().from(availability);
    const byDay = new Map(rows.map((r) => [r.weekday, r]));
    return DEFAULT_AVAILABILITY.map((def) => {
      const r = byDay.get(def.weekday);
      return r ? { weekday: r.weekday, enabled: r.enabled, slots: r.slots } : { ...def };
    });
  } catch (err) {
    console.error("[scheduling] failed to read availability:", err);
    return DEFAULT_AVAILABILITY.map((d) => ({ ...d }));
  }
}

/** Replace the weekly template (upsert one row per weekday). */
export async function setWeeklyAvailability(days: DayAvailability[]): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    for (const d of days) {
      await db
        .insert(availability)
        .values({ weekday: d.weekday, enabled: d.enabled, slots: d.slots })
        .onConflictDoUpdate({
          target: availability.weekday,
          set: { enabled: d.enabled, slots: d.slots },
        });
    }
    return true;
  } catch (err) {
    console.error("[scheduling] failed to save availability:", err);
    return false;
  }
}

// ─── Slot computation ────────────────────────────────────────────────────

export type DaySlots = { closed: boolean; slots: string[] };

/**
 * Slots a customer can actually request on a given date:
 * template − whole-day/specific blocks − already-taken (active) bookings.
 */
export async function getAvailableSlots(dateIso: string): Promise<DaySlots> {
  const weekday = weekdayOf(dateIso);
  const week = await getWeeklyAvailability();
  const dayCfg = week.find((d) => d.weekday === weekday);
  if (!dayCfg || !dayCfg.enabled) return { closed: true, slots: [] };

  const template = dayCfg.slots;

  if (!isDbConfigured || !db) {
    return { closed: false, slots: [...template] };
  }

  try {
    const [blocks, taken] = await Promise.all([
      db.select().from(blockedSlots).where(eq(blockedSlots.date, dateIso)),
      db
        .select({ time: bookings.time })
        .from(bookings)
        .where(
          and(eq(bookings.date, dateIso), inArray(bookings.status, ACTIVE_STATUSES))
        ),
    ]);

    if (blocks.some((b) => b.time === null)) return { closed: true, slots: [] };
    const blockedTimes = new Set(blocks.map((b) => b.time));
    const takenTimes = new Set(taken.map((t) => t.time));

    return {
      closed: false,
      slots: template.filter((t) => !blockedTimes.has(t) && !takenTimes.has(t)),
    };
  } catch (err) {
    console.error("[scheduling] failed to compute slots:", err);
    return { closed: false, slots: [...template] };
  }
}

// ─── Booking lifecycle ───────────────────────────────────────────────────

export type CreateBookingInput = {
  date: string;
  time: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  service?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type CreateBookingResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slot_taken" }
  | { ok: false; reason: "db_unconfigured" }
  | { ok: false; reason: "error" };

/**
 * Reserve a slot in `requested` state. The DB's partial unique index is the
 * real guard against double-booking; a concurrent insert surfaces here as
 * `slot_taken`.
 */
export async function createBookingRequest(
  input: CreateBookingInput,
  leadId?: string
): Promise<CreateBookingResult> {
  if (!isDbConfigured || !db) return { ok: false, reason: "db_unconfigured" };
  try {
    const rows = await db
      .insert(bookings)
      .values({
        leadId: leadId ?? null,
        status: "requested",
        date: input.date,
        time: input.time,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        service: input.service ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
      })
      .returning({ id: bookings.id });
    return { ok: true, id: rows[0]!.id };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "slot_taken" };
    console.error("[scheduling] failed to create booking:", err);
    return { ok: false, reason: "error" };
  }
}

/** Link a reserved booking row to the lead it produced (best-effort). */
export async function linkBookingLead(bookingId: string, leadId: string): Promise<void> {
  if (!isDbConfigured || !db) return;
  try {
    await db.update(bookings).set({ leadId }).where(eq(bookings.id, bookingId));
  } catch (err) {
    console.error("[scheduling] failed to link booking to lead:", err);
  }
}

/** JSON-safe booking for the admin client UI. */
export type AdminBooking = {
  id: string;
  status: BookingStatus;
  date: string;
  time: string;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export async function listBookingsBetween(
  startIso: string,
  endIso: string
): Promise<AdminBooking[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(bookings)
      .where(and(gte(bookings.date, startIso), lte(bookings.date, endIso)))
      .orderBy(asc(bookings.date), asc(bookings.time));
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      date: r.date,
      time: r.time,
      name: r.name,
      phone: r.phone,
      email: r.email,
      service: r.service,
      address: r.address,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    }));
  } catch (err) {
    console.error("[scheduling] failed to list bookings:", err);
    return [];
  }
}

/** The most recent booking tied to a lead, or null. */
export async function findBookingByLead(
  leadId: string
): Promise<{ id: string; date: string; time: string; status: BookingStatus } | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const rows = await db
      .select({
        id: bookings.id,
        date: bookings.date,
        time: bookings.time,
        status: bookings.status,
      })
      .from(bookings)
      .where(eq(bookings.leadId, leadId))
      .orderBy(desc(bookings.createdAt))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error("[scheduling] failed to find booking by lead:", err);
    return null;
  }
}

/**
 * The active (requested/confirmed) booking occupying a slot, or null. The
 * partial unique index guarantees at most one — used to find the booking a
 * public submission created when it isn't directly linked to the lead.
 */
export async function findActiveBookingAt(
  date: string,
  time: string
): Promise<{ id: string; date: string; time: string; status: BookingStatus } | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const rows = await db
      .select({
        id: bookings.id,
        date: bookings.date,
        time: bookings.time,
        status: bookings.status,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.date, date),
          eq(bookings.time, time),
          inArray(bookings.status, ACTIVE_STATUSES)
        )
      )
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error("[scheduling] failed to find active booking:", err);
    return null;
  }
}

export async function decideBooking(
  id: string,
  status: Extract<BookingStatus, "confirmed" | "declined" | "cancelled">
): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    // Only transition from an active state. Re-confirming a declined/cancelled
    // booking could collide with the slot's partial unique index, so block it
    // here and report whether a row actually changed.
    const allowedFrom: BookingStatus[] =
      status === "confirmed" ? ["requested"] : ["requested", "confirmed"];
    const updated = await db
      .update(bookings)
      .set({ status, decidedAt: new Date() })
      .where(and(eq(bookings.id, id), inArray(bookings.status, allowedFrom)))
      .returning({ id: bookings.id });
    return updated.length > 0;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    console.error("[scheduling] failed to decide booking:", err);
    return false;
  }
}

// ─── Blocked slots ───────────────────────────────────────────────────────

export type AdminBlock = {
  id: string;
  date: string;
  time: string | null;
  reason: string | null;
};

export async function listBlocksBetween(
  startIso: string,
  endIso: string
): Promise<AdminBlock[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(blockedSlots)
      .where(and(gte(blockedSlots.date, startIso), lte(blockedSlots.date, endIso)))
      .orderBy(asc(blockedSlots.date));
    return rows.map((r) => ({ id: r.id, date: r.date, time: r.time, reason: r.reason }));
  } catch (err) {
    console.error("[scheduling] failed to list blocks:", err);
    return [];
  }
}

export async function addBlock(
  date: string,
  time: string | null,
  reason: string | null
): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    await db.insert(blockedSlots).values({ date, time, reason });
    return true;
  } catch (err) {
    console.error("[scheduling] failed to add block:", err);
    return false;
  }
}

export async function removeBlock(id: string): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    const deleted = await db
      .delete(blockedSlots)
      .where(eq(blockedSlots.id, id))
      .returning({ id: blockedSlots.id });
    return deleted.length > 0;
  } catch (err) {
    console.error("[scheduling] failed to remove block:", err);
    return false;
  }
}
