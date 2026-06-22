import { isDbConfigured } from "@/lib/db";
import { isAuthConfigured } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import AdminTopBar from "@/components/admin/AdminTopBar";
import Dashboard from "@/components/admin/Dashboard";

// Always render fresh — reads live data and the session cookie.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminHead">
          <div>
            <h1 className="adminTitle">
              Dash<span className="accent">board</span>
            </h1>
            <p className="adminSub">
              Everything that needs Albert&apos;s attention, at a glance.
            </p>
          </div>
        </div>

        {!isDbConfigured ? (
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Database not connected</p>
              <p>
                The dashboard lights up once a database is connected. Set{" "}
                <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
                Until then the public site still takes bookings and logs them to
                the server console.
              </p>
            </div>
          </div>
        ) : (
          <Dashboard stats={stats} />
        )}

        {!isAuthConfigured && (
          <p className="adminNotice" style={{ marginTop: 24 }}>
            Heads up: this console is <strong>not password-protected</strong> yet.
            Set <code>ADMIN_PASSWORD</code> and <code>AUTH_SECRET</code> to lock it down.
          </p>
        )}
      </main>
    </>
  );
}
