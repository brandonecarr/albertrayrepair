import { isDbConfigured } from "@/lib/db";
import { isAuthConfigured } from "@/lib/auth";
import { listLeads } from "@/lib/leads";
import AdminTopBar from "@/components/admin/AdminTopBar";
import LeadInbox from "@/components/admin/LeadInbox";

// Always render fresh — this reads live data and the session cookie.
export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
  const { items: leads, nextCursor } = await listLeads();

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminHead">
          <div>
            <h1 className="adminTitle">
              Lead <span className="accent">Inbox</span>
            </h1>
            <p className="adminSub">
              Every booking request and contact message, newest first.
            </p>
          </div>
        </div>

        {!isDbConfigured ? (
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Database not connected</p>
              <p>
                Leads are being logged to the server console but not stored.
                <br />
                Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>{" "}
                to turn on the inbox.
              </p>
            </div>
          </div>
        ) : (
          <LeadInbox initialLeads={leads} initialCursor={nextCursor} />
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
