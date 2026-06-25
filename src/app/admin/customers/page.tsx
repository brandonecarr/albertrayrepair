import { isDbConfigured } from "@/lib/db";
import { listCustomers } from "@/lib/customers";
import AdminTopBar from "@/components/admin/AdminTopBar";
import CustomerList from "@/components/admin/CustomerList";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { items: customers, nextCursor } = await listCustomers();

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminHead">
          <div>
            <h1 className="adminTitle">
              All <span className="accent">Customers</span>
            </h1>
            <p className="adminSub">
              All customers who have reached out via website form, phone and email.
            </p>
          </div>
        </div>

        {!isDbConfigured ? (
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Database not connected</p>
              <p>
                Customers are built automatically from incoming leads once a
                database is connected. Set <code>DATABASE_URL</code> and run{" "}
                <code>npm run db:migrate</code> to turn this on.
              </p>
            </div>
          </div>
        ) : (
          <CustomerList customers={customers} initialCursor={nextCursor} />
        )}
      </main>
    </>
  );
}
