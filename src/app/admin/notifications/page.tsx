import { isDbConfigured } from "@/lib/db";
import { listNotifications } from "@/lib/notifications";
import AdminTopBar from "@/components/admin/AdminTopBar";
import NotificationsManager from "@/components/admin/NotificationsManager";

export const dynamic = "force-dynamic";

const hasResend = Boolean(process.env.RESEND_API_KEY);

export default async function NotificationsPage() {
  const items = await listNotifications();

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminHead">
          <div>
            <h1 className="adminTitle">
              Outgoing <span className="accent">Notifications</span>
            </h1>
            <p className="adminSub">
              Automatic messages sent to customers. Toggle them on/off and edit
              the wording.
            </p>
          </div>
        </div>

        {!hasResend && (
          <p className="adminNotice" style={{ marginBottom: 18 }}>
            <strong>Email isn&rsquo;t connected yet.</strong> Messages are logged
            to the server but not delivered. Add a <code>RESEND_API_KEY</code>{" "}
            (and verify a sending domain) to start sending real email — no code
            changes needed.
          </p>
        )}

        {!isDbConfigured ? (
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Showing default messages</p>
              <p>
                These defaults are live. Connect <code>DATABASE_URL</code> to
                customize and save the wording.
              </p>
            </div>
          </div>
        ) : (
          <NotificationsManager items={items} />
        )}
      </main>
    </>
  );
}
