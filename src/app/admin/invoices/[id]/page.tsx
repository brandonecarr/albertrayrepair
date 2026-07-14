import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { getQuote } from "@/lib/quotes";
import { getCustomer } from "@/lib/customers";
import { getJobById } from "@/lib/jobs";
import AdminTopBar from "@/components/admin/AdminTopBar";
import InvoiceDetail from "@/components/admin/InvoiceDetail";

export const dynamic = "force-dynamic";

export default async function InvoicePage(ctx: { params: Promise<{ id: string }> }) {
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
                Connect <code>DATABASE_URL</code> to view invoices.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  const invoice = await getQuote(id);
  if (!invoice) notFound();

  const [customer, job] = await Promise.all([
    getCustomer(invoice.customerId),
    invoice.jobId ? getJobById(invoice.jobId) : Promise.resolve(null),
  ]);

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <Link
          href={invoice.jobId ? `/admin/jobs/${invoice.jobId}` : `/admin/customers/${invoice.customerId}`}
          className="adminBack"
        >
          ← Back
        </Link>
        <InvoiceDetail
          invoice={invoice}
          customerName={customer?.name ?? null}
          customerEmail={customer?.email ?? null}
          customerPhone={customer?.phone ?? null}
          jobTitle={job?.title ?? null}
        />
      </main>
    </>
  );
}
