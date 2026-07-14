/**
 * Job persistence — the billable-work lifecycle layered on top of customers.
 *
 * Lifecycle: quoted → scheduled → in_progress → completed → invoiced, with
 * `cancelled` as a terminal off-ramp. All functions no-op gracefully when the
 * DB is not configured.
 */
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { clampLimit, type Cursor, type Page } from "./pagination";
import { jobs, jobNotes, customers, bookings, type Job, type JobStatus } from "./db/schema";
import { findOrCreateCustomer } from "./customers";
import { getLeadById, setLeadStatus } from "./leads";
import {
  findBookingByLead,
  findActiveBookingAt,
  decideBooking,
  createBookingRequest,
} from "./scheduling";

/** Pipeline order, used to render the job board columns left → right. */
export const JOB_STATUSES: JobStatus[] = [
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  quoted: "Quoted",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

/** Plain, JSON-safe shape passed to admin client components. */
export type AdminJob = {
  id: string;
  customerId: string;
  customerName: string | null;
  leadId: string | null;
  bookingId: string | null;
  quoteId: string | null;
  title: string;
  status: JobStatus;
  amountCents: number | null;
  discountType: string | null; // 'fixed' | 'percent' | null
  discountCents: number | null; // fixed discounts
  discountBps: number | null; // percent discounts (basis points)
  scheduledDate: string | null;
  scheduledTime: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

function toAdminJob(j: Job, customerName: string | null = null): AdminJob {
  return {
    id: j.id,
    customerId: j.customerId,
    customerName,
    leadId: j.leadId,
    bookingId: j.bookingId,
    quoteId: j.quoteId,
    title: j.title,
    status: j.status,
    amountCents: j.amountCents,
    discountType: j.discountType,
    discountCents: j.discountCents,
    discountBps: j.discountBps,
    scheduledDate: j.scheduledDate,
    scheduledTime: j.scheduledTime,
    address: j.address,
    notes: j.notes,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    completedAt: j.completedAt ? j.completedAt.toISOString() : null,
  };
}

type CreateJobInput = {
  customerId: string;
  title: string;
  status?: JobStatus;
  amountCents?: number | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  address?: string | null;
  notes?: string | null;
  leadId?: string | null;
  bookingId?: string | null;
  quoteId?: string | null;
};

/** Create a job. Returns the new id, or null when the DB isn't configured. */
export async function createJob(input: CreateJobInput): Promise<string | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const inserted = await db
      .insert(jobs)
      .values({
        customerId: input.customerId,
        title: input.title,
        status: input.status ?? "quoted",
        amountCents: input.amountCents ?? null,
        scheduledDate: input.scheduledDate ?? null,
        scheduledTime: input.scheduledTime ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        leadId: input.leadId ?? null,
        bookingId: input.bookingId ?? null,
        quoteId: input.quoteId ?? null,
      })
      .returning({ id: jobs.id });
    return inserted[0]?.id ?? null;
  } catch (err) {
    console.error("[db] failed to create job:", err);
    return null;
  }
}

export type JobFromBookingResult =
  | { ok: true; id: string; customerId: string; alreadyExisted: boolean }
  | { ok: false; reason: "not_found" | "db_unconfigured" | "error" };

/**
 * Turn a booking into a tracked job: find/create the customer from the
 * booking's contact info, then create a `scheduled` job linked to both.
 * Idempotent — if a job is already linked to this booking, returns it instead
 * of creating a duplicate.
 */
export async function createJobFromBooking(
  bookingId: string
): Promise<JobFromBookingResult> {
  if (!isDbConfigured || !db) return { ok: false, reason: "db_unconfigured" };
  try {
    const found = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = found[0];
    if (!booking) return { ok: false, reason: "not_found" };

    // Already converted? Return the existing job.
    const existing = await db
      .select({ id: jobs.id, customerId: jobs.customerId })
      .from(jobs)
      .where(eq(jobs.bookingId, bookingId))
      .limit(1);
    if (existing[0]) {
      return {
        ok: true,
        id: existing[0].id,
        customerId: existing[0].customerId,
        alreadyExisted: true,
      };
    }

    const customerId = await findOrCreateCustomer({
      name: booking.name,
      phone: booking.phone,
      email: booking.email,
      address: booking.address,
    });
    if (!customerId) return { ok: false, reason: "error" };

    const id = await createJob({
      customerId,
      title: booking.service || "Service call",
      status: "scheduled",
      scheduledDate: booking.date,
      scheduledTime: booking.time,
      address: booking.address,
      notes: booking.notes,
      leadId: booking.leadId,
      bookingId: booking.id,
    });
    if (!id) return { ok: false, reason: "error" };

    return { ok: true, id, customerId, alreadyExisted: false };
  } catch (err) {
    console.error("[db] failed to create job from booking:", err);
    return { ok: false, reason: "error" };
  }
}

export type JobFromLeadResult =
  | { ok: true; jobId: string; date: string | null; onCalendar: boolean }
  | { ok: false; reason: "not_found" | "db_unconfigured" | "error" };

/**
 * Turn an inbox lead into a tracked job and put it on the calendar.
 * - Booking leads already have a calendar entry: confirm it and convert it.
 * - Contact leads with a preferred date: create a confirmed booking + job.
 * - Otherwise: create an unscheduled job (nothing to place on the calendar).
 * Marks the lead "won". Idempotent for booking leads via createJobFromBooking.
 */
export async function createJobFromLead(
  leadId: string
): Promise<JobFromLeadResult> {
  if (!isDbConfigured || !db) return { ok: false, reason: "db_unconfigured" };
  try {
    const lead = await getLeadById(leadId);
    if (!lead) return { ok: false, reason: "not_found" };

    // 1) Lead already has a booking on the calendar — confirm + convert it.
    // Public submissions don't link booking↔lead, so fall back to matching the
    // active booking sitting in the lead's requested slot.
    const existing =
      (await findBookingByLead(leadId)) ??
      (lead.preferredDate && lead.preferredTime
        ? await findActiveBookingAt(lead.preferredDate, lead.preferredTime)
        : null);
    if (existing) {
      if (existing.status === "requested") {
        await decideBooking(existing.id, "confirmed");
      }
      const res = await createJobFromBooking(existing.id);
      if (!res.ok) return { ok: false, reason: "error" };
      await setLeadStatus(leadId, "won");
      return { ok: true, jobId: res.id, date: existing.date, onCalendar: true };
    }

    // 2) No booking yet. If the lead carries a date/time, schedule it.
    if (lead.preferredDate && lead.preferredTime) {
      const reservation = await createBookingRequest(
        {
          date: lead.preferredDate,
          time: lead.preferredTime,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          service: lead.service,
          address: lead.address,
          notes: lead.message,
        },
        leadId
      );
      if (reservation.ok) {
        await decideBooking(reservation.id, "confirmed");
        const res = await createJobFromBooking(reservation.id);
        if (res.ok) {
          await setLeadStatus(leadId, "won");
          return { ok: true, jobId: res.id, date: lead.preferredDate, onCalendar: true };
        }
      }
      // slot taken / booking failed — fall through to an unscheduled job
    }

    // 3) No date (or scheduling failed) — create an unscheduled job.
    const customerId =
      lead.customerId ??
      (await findOrCreateCustomer({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
      }));
    if (!customerId) return { ok: false, reason: "error" };

    const jobId = await createJob({
      customerId,
      title: lead.service || "Service call",
      leadId,
      scheduledDate: lead.preferredDate,
      scheduledTime: lead.preferredTime,
      address: lead.address,
      notes: lead.message,
    });
    if (!jobId) return { ok: false, reason: "error" };
    await setLeadStatus(leadId, "won");
    return { ok: true, jobId, date: null, onCalendar: false };
  } catch (err) {
    console.error("[db] createJobFromLead failed:", err);
    return { ok: false, reason: "error" };
  }
}

// ─── Job notes (timestamped log) ───────────────────────────────────────────

export type AdminJobNote = { id: string; body: string; createdAt: string };

export async function listJobNotes(jobId: string): Promise<AdminJobNote[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(jobNotes)
      .where(eq(jobNotes.jobId, jobId))
      .orderBy(desc(jobNotes.createdAt));
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error("[db] failed to list job notes:", err);
    return [];
  }
}

export async function addJobNote(
  jobId: string,
  body: string
): Promise<AdminJobNote | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const rows = await db.insert(jobNotes).values({ jobId, body }).returning();
    const r = rows[0];
    return r ? { id: r.id, body: r.body, createdAt: r.createdAt.toISOString() } : null;
  } catch (err) {
    console.error("[db] failed to add job note:", err);
    return null;
  }
}

export async function deleteJobNote(noteId: string): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    await db.delete(jobNotes).where(eq(jobNotes.id, noteId));
    return true;
  } catch (err) {
    console.error("[db] failed to delete job note:", err);
    return false;
  }
}

/** A single job (with its customer name) by id, or null. */
export async function getJobById(id: string): Promise<AdminJob | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const rows = await db
      .select({ job: jobs, customerName: customers.name })
      .from(jobs)
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .where(eq(jobs.id, id))
      .limit(1);
    return rows[0] ? toAdminJob(rows[0].job, rows[0].customerName) : null;
  } catch (err) {
    console.error("[db] failed to get job:", err);
    return null;
  }
}

/**
 * Map of bookingId → jobId for any bookings that already have a job. Lets the
 * calendar show "View job" (linking to the job page) instead of "+ Job".
 */
export async function getJobLinksForBookings(
  bookingIds: string[]
): Promise<Record<string, string>> {
  if (!isDbConfigured || !db || bookingIds.length === 0) return {};
  try {
    const rows = await db
      .select({ bookingId: jobs.bookingId, jobId: jobs.id })
      .from(jobs)
      .where(inArray(jobs.bookingId, bookingIds));
    const map: Record<string, string> = {};
    for (const r of rows) if (r.bookingId) map[r.bookingId] = r.jobId;
    return map;
  } catch (err) {
    console.error("[db] failed to load job links:", err);
    return {};
  }
}

/** A page of jobs with their customer name, newest first (keyset paginated). */
export async function listJobs(
  opts: { limit?: number; before?: Cursor } = {}
): Promise<Page<AdminJob>> {
  if (!isDbConfigured || !db) return { items: [], nextCursor: null };
  const limit = clampLimit(opts.limit);
  try {
    const where = opts.before
      ? sql`(${jobs.createdAt}, ${jobs.id}) < (${new Date(opts.before.createdAt)}, ${opts.before.id})`
      : undefined;
    const rows = await db
      .select({ job: jobs, customerName: customers.name })
      .from(jobs)
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .where(where)
      .orderBy(desc(jobs.createdAt), desc(jobs.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => toAdminJob(r.job, r.customerName));
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  } catch (err) {
    console.error("[db] failed to list jobs:", err);
    return { items: [], nextCursor: null };
  }
}

/** Jobs for one customer, newest first. */
export async function listJobsForCustomer(
  customerId: string
): Promise<AdminJob[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.customerId, customerId))
      .orderBy(desc(jobs.createdAt));
    return rows.map((j) => toAdminJob(j));
  } catch (err) {
    console.error("[db] failed to list customer jobs:", err);
    return [];
  }
}

/**
 * Move a job to a new lifecycle status. Stamps completedAt on completion and
 * clears it when moving back to an unfinished state (so "completed on" and the
 * revenue date never show a stale timestamp). "invoiced" keeps the existing
 * completion date since it's a post-completion state.
 */
export async function setJobStatus(
  id: string,
  status: JobStatus
): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    const set: Partial<typeof jobs.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };
    if (status === "completed") set.completedAt = new Date();
    else if (status !== "invoiced") set.completedAt = null;
    await db.update(jobs).set(set).where(eq(jobs.id, id));
    return true;
  } catch (err) {
    console.error("[db] failed to set job status:", err);
    return false;
  }
}

type JobPatch = {
  title?: string;
  amountCents?: number | null;
  discountType?: string | null;
  discountCents?: number | null;
  discountBps?: number | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  address?: string | null;
  notes?: string | null;
};

/** Update a job's editable fields. */
export async function updateJob(id: string, patch: JobPatch): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    const set: Partial<typeof jobs.$inferInsert> = { updatedAt: new Date() };
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.amountCents !== undefined) set.amountCents = patch.amountCents;
    if (patch.discountType !== undefined) set.discountType = patch.discountType;
    if (patch.discountCents !== undefined) set.discountCents = patch.discountCents;
    if (patch.discountBps !== undefined) set.discountBps = patch.discountBps;
    if (patch.scheduledDate !== undefined) set.scheduledDate = patch.scheduledDate;
    if (patch.scheduledTime !== undefined) set.scheduledTime = patch.scheduledTime;
    if (patch.address !== undefined) set.address = patch.address;
    if (patch.notes !== undefined) set.notes = patch.notes;
    await db.update(jobs).set(set).where(eq(jobs.id, id));
    return true;
  } catch (err) {
    console.error("[db] failed to update job:", err);
    return false;
  }
}
