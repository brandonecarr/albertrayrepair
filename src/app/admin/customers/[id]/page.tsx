import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { getCustomer } from "@/lib/customers";
import { listLeadsForCustomer } from "@/lib/leads";
import { listJobsForCustomer } from "@/lib/jobs";
import { listQuotesForCustomer } from "@/lib/quotes";
import { listPaymentsForCustomer, getCustomerLifetimeSpendCents } from "@/lib/payments";
import AdminTopBar from "@/components/admin/AdminTopBar";
import CustomerDetail from "@/components/admin/CustomerDetail";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage(ctx: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await ctx.params;

  if (!isDbConfigured) {
    return (
      <>
        <AdminTopBar />
        <main className="adminMain">
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Database not connected</p>
              <p>
                Connect <code>DATABASE_URL</code> to view customer records.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const [leads, jobs, quotes, payments, lifetimeSpentCents] = await Promise.all([
    listLeadsForCustomer(id),
    listJobsForCustomer(id),
    listQuotesForCustomer(id),
    listPaymentsForCustomer(id),
    getCustomerLifetimeSpendCents(id),
  ]);

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <Link href="/admin/customers" className="adminBack">
          ← All customers
        </Link>
        <CustomerDetail
          customer={customer}
          leads={leads}
          jobs={jobs}
          quotes={quotes}
          payments={payments}
          lifetimeSpentCents={lifetimeSpentCents}
        />
      </main>
    </>
  );
}
