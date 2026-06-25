/**
 * Reporting aggregates — P&L, KPIs, and breakdowns over a date range.
 * Revenue = completed/invoiced job value (by completion date). Material cost =
 * company-purchased materials. Profit = revenue − material cost. Open pipeline
 * is a current snapshot (not date-filtered). No-ops to zeros without a DB.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { jobs, jobMaterials, payments, customers, leads } from "./db/schema";

export type ReportData = {
  revenueCents: number;
  completedJobs: number;
  avgJobValueCents: number;
  materialCostCents: number; // company-purchased
  clientMaterialCents: number; // client-purchased
  grossProfitCents: number;
  marginPct: number; // 0–100
  paymentsCollectedCents: number;
  newCustomers: number;
  newLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionPct: number; // won / total leads
  pipelineCents: number; // current open jobs
  pipelineJobs: number;
  revenueByMonth: { month: string; cents: number }[]; // ascending
  topCustomers: { id: string; name: string; cents: number }[];
};

const EMPTY: ReportData = {
  revenueCents: 0,
  completedJobs: 0,
  avgJobValueCents: 0,
  materialCostCents: 0,
  clientMaterialCents: 0,
  grossProfitCents: 0,
  marginPct: 0,
  paymentsCollectedCents: 0,
  newCustomers: 0,
  newLeads: 0,
  wonLeads: 0,
  lostLeads: 0,
  conversionPct: 0,
  pipelineCents: 0,
  pipelineJobs: 0,
  revenueByMonth: [],
  topCustomers: [],
};

const DONE = ["completed", "invoiced"] as const;
const OPEN = ["quoted", "scheduled", "in_progress"] as const;

export async function getReport(from: Date, to: Date): Promise<ReportData> {
  if (!isDbConfigured || !db) return EMPTY;

  // Revenue recognized on the job's completion date (fall back if unset).
  const revDate = sql`coalesce(${jobs.completedAt}, ${jobs.updatedAt}, ${jobs.createdAt})`;

  try {
    const [revRows, matRows, payRows, custRows, leadRows, pipeRows, monthRows, topRows] =
      await Promise.all([
        db
          .select({
            total: sql<number>`coalesce(sum(${jobs.amountCents}),0)`,
            cnt: sql<number>`count(*)`,
            billable: sql<number>`count(*) filter (where ${jobs.amountCents} is not null and ${jobs.amountCents} > 0)`,
          })
          .from(jobs)
          .where(and(inArray(jobs.status, [...DONE]), sql`${revDate} between ${from} and ${to}`)),

        db
          .select({
            company: sql<number>`coalesce(sum(case when ${jobMaterials.purchaser}='company' then ${jobMaterials.priceCents} else 0 end),0)`,
            client: sql<number>`coalesce(sum(case when ${jobMaterials.purchaser}='client' then ${jobMaterials.priceCents} else 0 end),0)`,
          })
          .from(jobMaterials)
          .where(sql`${jobMaterials.createdAt} between ${from} and ${to}`),

        db
          .select({ total: sql<number>`coalesce(sum(${payments.amountCents}),0)` })
          .from(payments)
          .where(
            and(
              eq(payments.status, "succeeded"),
              sql`coalesce(${payments.paidAt}, ${payments.createdAt}) between ${from} and ${to}`
            )
          ),

        db
          .select({ cnt: sql<number>`count(*)` })
          .from(customers)
          .where(sql`${customers.createdAt} between ${from} and ${to}`),

        db
          .select({
            total: sql<number>`count(*)`,
            won: sql<number>`count(*) filter (where ${leads.status}='won')`,
            lost: sql<number>`count(*) filter (where ${leads.status}='lost')`,
          })
          .from(leads)
          .where(sql`${leads.createdAt} between ${from} and ${to}`),

        db
          .select({
            total: sql<number>`coalesce(sum(${jobs.amountCents}),0)`,
            cnt: sql<number>`count(*)`,
          })
          .from(jobs)
          .where(inArray(jobs.status, [...OPEN])),

        db
          .select({
            month: sql<string>`to_char(${revDate} at time zone 'America/Los_Angeles', 'YYYY-MM')`,
            cents: sql<number>`coalesce(sum(${jobs.amountCents}),0)`,
          })
          .from(jobs)
          .where(and(inArray(jobs.status, [...DONE]), sql`${revDate} between ${from} and ${to}`))
          .groupBy(sql`to_char(${revDate} at time zone 'America/Los_Angeles', 'YYYY-MM')`)
          .orderBy(sql`1`),

        db
          .select({
            id: jobs.customerId,
            name: customers.name,
            cents: sql<number>`coalesce(sum(${jobs.amountCents}),0)`,
          })
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .where(and(inArray(jobs.status, [...DONE]), sql`${revDate} between ${from} and ${to}`))
          .groupBy(jobs.customerId, customers.name)
          .orderBy(desc(sql`coalesce(sum(${jobs.amountCents}),0)`))
          .limit(5),
      ]);

    const revenueCents = Number(revRows[0]?.total ?? 0);
    const completedJobs = Number(revRows[0]?.cnt ?? 0);
    const billableJobs = Number(revRows[0]?.billable ?? 0);
    const materialCostCents = Number(matRows[0]?.company ?? 0);
    const clientMaterialCents = Number(matRows[0]?.client ?? 0);
    const grossProfitCents = revenueCents - materialCostCents;
    const newLeads = Number(leadRows[0]?.total ?? 0);
    const wonLeads = Number(leadRows[0]?.won ?? 0);

    return {
      revenueCents,
      completedJobs,
      avgJobValueCents: billableJobs > 0 ? Math.round(revenueCents / billableJobs) : 0,
      materialCostCents,
      clientMaterialCents,
      grossProfitCents,
      marginPct: revenueCents > 0 ? Math.round((grossProfitCents / revenueCents) * 100) : 0,
      paymentsCollectedCents: Number(payRows[0]?.total ?? 0),
      newCustomers: Number(custRows[0]?.cnt ?? 0),
      newLeads,
      wonLeads,
      lostLeads: Number(leadRows[0]?.lost ?? 0),
      conversionPct: newLeads > 0 ? Math.round((wonLeads / newLeads) * 100) : 0,
      pipelineCents: Number(pipeRows[0]?.total ?? 0),
      pipelineJobs: Number(pipeRows[0]?.cnt ?? 0),
      revenueByMonth: monthRows.map((r) => ({ month: r.month, cents: Number(r.cents) })),
      topCustomers: topRows
        .filter((r) => r.id)
        .map((r) => ({ id: r.id as string, name: r.name ?? "—", cents: Number(r.cents) })),
    };
  } catch (err) {
    console.error("[reports] failed to build report:", err);
    return EMPTY;
  }
}
