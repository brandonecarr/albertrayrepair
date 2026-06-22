/**
 * Dashboard aggregator — rolls up the figures Albert wants the moment he
 * opens the console. Reuses the existing data-layer reads so it stays in sync
 * with the inbox, calendar, and job board, and returns zeros/empties (never
 * throws) when the DB is unconfigured.
 */
import { listLeads, type AdminLead } from "./leads";
import { listJobs } from "./jobs";
import { listBookingsBetween, type AdminBooking } from "./scheduling";
import { isoOf, startOfWeekIso, addDays } from "./date-utils";
import type { JobStatus } from "./db/schema";

const OPEN_JOB_STATUSES: JobStatus[] = ["quoted", "scheduled", "in_progress"];

export type DashboardStats = {
  newLeads: number;
  unreadLeads: number;
  totalCustomersTouched: number;
  openPipelineCents: number;
  activeJobs: number;
  todaysBookings: AdminBooking[];
  weekConfirmed: number;
  recentLeads: AdminLead[];
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const todayIso = isoOf(new Date());
  const weekStart = startOfWeekIso(todayIso);
  const weekEnd = addDays(weekStart, 6);

  const [leads, jobs, todaysAll, weekAll] = await Promise.all([
    listLeads(),
    listJobs(),
    listBookingsBetween(todayIso, todayIso),
    listBookingsBetween(weekStart, weekEnd),
  ]);

  const todaysBookings = todaysAll.filter(
    (b) => b.status === "confirmed" || b.status === "requested"
  );

  return {
    newLeads: leads.filter((l) => l.status === "new").length,
    unreadLeads: leads.filter((l) => !l.readAt).length,
    totalCustomersTouched: new Set(
      leads.map((l) => l.customerId).filter(Boolean)
    ).size,
    openPipelineCents: jobs
      .filter((j) => OPEN_JOB_STATUSES.includes(j.status))
      .reduce((sum, j) => sum + (j.amountCents ?? 0), 0),
    activeJobs: jobs.filter((j) => OPEN_JOB_STATUSES.includes(j.status)).length,
    todaysBookings,
    weekConfirmed: weekAll.filter((b) => b.status === "confirmed").length,
    recentLeads: leads.slice(0, 6),
  };
}
