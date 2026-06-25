/**
 * Dashboard aggregator — rolls up the figures Albert wants the moment he opens
 * the console. Uses targeted COUNT/SUM aggregates (not full-table loads) so the
 * home screen stays fast no matter how many leads/jobs accumulate. Returns
 * zeros/empties (never throws) when the DB is unconfigured.
 */
import { sql } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { leads, jobs } from "./db/schema";
import { listRecentLeads, type AdminLead } from "./leads";
import { listBookingsBetween, type AdminBooking } from "./scheduling";
import { startOfWeekIso, addDays } from "./date-utils";
import { businessTodayIso } from "./timezone";

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

const EMPTY: DashboardStats = {
  newLeads: 0,
  unreadLeads: 0,
  totalCustomersTouched: 0,
  openPipelineCents: 0,
  activeJobs: 0,
  todaysBookings: [],
  weekConfirmed: 0,
  recentLeads: [],
};

export async function getDashboardStats(): Promise<DashboardStats> {
  if (!isDbConfigured || !db) return EMPTY;

  const todayIso = businessTodayIso();
  const weekStart = startOfWeekIso(todayIso);
  const weekEnd = addDays(weekStart, 6);

  try {
    const [leadAgg, jobAgg, recentLeads, todaysAll, weekAll] = await Promise.all([
      db
        .select({
          newLeads: sql<number>`count(*) filter (where ${leads.status} = 'new')`,
          unreadLeads: sql<number>`count(*) filter (where ${leads.readAt} is null)`,
          touched: sql<number>`count(distinct ${leads.customerId})`,
        })
        .from(leads),
      db
        .select({
          pipeline: sql<number>`coalesce(sum(${jobs.amountCents}) filter (where ${jobs.status} in ('quoted','scheduled','in_progress')), 0)`,
          active: sql<number>`count(*) filter (where ${jobs.status} in ('quoted','scheduled','in_progress'))`,
        })
        .from(jobs),
      listRecentLeads(6),
      listBookingsBetween(todayIso, todayIso),
      listBookingsBetween(weekStart, weekEnd),
    ]);

    return {
      newLeads: Number(leadAgg[0]?.newLeads ?? 0),
      unreadLeads: Number(leadAgg[0]?.unreadLeads ?? 0),
      totalCustomersTouched: Number(leadAgg[0]?.touched ?? 0),
      openPipelineCents: Number(jobAgg[0]?.pipeline ?? 0),
      activeJobs: Number(jobAgg[0]?.active ?? 0),
      todaysBookings: todaysAll.filter(
        (b) => b.status === "confirmed" || b.status === "requested"
      ),
      weekConfirmed: weekAll.filter((b) => b.status === "confirmed").length,
      recentLeads,
    };
  } catch (err) {
    console.error("[dashboard] failed to build stats:", err);
    return EMPTY;
  }
}
