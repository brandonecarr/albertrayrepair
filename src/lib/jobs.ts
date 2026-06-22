/**
 * Job persistence — the billable-work lifecycle layered on top of customers.
 *
 * Lifecycle: quoted → scheduled → in_progress → completed → invoiced, with
 * `cancelled` as a terminal off-ramp. All functions no-op gracefully when the
 * DB is not configured.
 */
import { desc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { jobs, customers, bookings, type Job, type JobStatus } from "./db/schema";
import { findOrCreateCustomer } from "./customers";

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

/** All jobs with their customer name, newest first. */
export async function listJobs(): Promise<AdminJob[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select({ job: jobs, customerName: customers.name })
      .from(jobs)
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .orderBy(desc(jobs.createdAt));
    return rows.map((r) => toAdminJob(r.job, r.customerName));
  } catch (err) {
    console.error("[db] failed to list jobs:", err);
    return [];
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

/** Move a job to a new lifecycle status. Stamps completedAt on completion. */
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
