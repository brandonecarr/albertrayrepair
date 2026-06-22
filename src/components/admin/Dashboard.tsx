import Link from "next/link";
import type { DashboardStats } from "@/lib/dashboard";

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard({ stats }: { stats: DashboardStats }) {
  const empty =
    stats.newLeads === 0 &&
    stats.activeJobs === 0 &&
    stats.todaysBookings.length === 0 &&
    stats.recentLeads.length === 0;

  if (empty) {
    return (
      <div className="adminEmpty">
        <div>
          <p className="adminEmptyTitle">All quiet</p>
          <p>
            No leads or jobs yet. New booking requests and contact messages will
            surface here the moment they come in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      {/* KPI strip */}
      <div className="dashStats">
        <Link href="/admin/inbox" className="dashStat">
          <span className="dashStatNum">{stats.newLeads}</span>
          <span className="dashStatLabel">New leads</span>
          {stats.unreadLeads > 0 && (
            <span className="dashStatNote">{stats.unreadLeads} unread</span>
          )}
        </Link>
        <Link href="/admin/jobs" className="dashStat">
          <span className="dashStatNum">{stats.activeJobs}</span>
          <span className="dashStatLabel">Active jobs</span>
        </Link>
        <Link href="/admin/jobs" className="dashStat dashStatMoney">
          <span className="dashStatNum">{money(stats.openPipelineCents)}</span>
          <span className="dashStatLabel">Open pipeline</span>
        </Link>
        <Link href="/admin/calendar" className="dashStat">
          <span className="dashStatNum">{stats.weekConfirmed}</span>
          <span className="dashStatLabel">Confirmed this week</span>
        </Link>
      </div>

      <div className="dashCols">
        {/* Today's schedule */}
        <section className="dashPanel">
          <div className="dashPanelHead">
            <h2 className="dashPanelTitle">Today</h2>
            <Link href="/admin/calendar" className="dashPanelLink">
              Calendar →
            </Link>
          </div>
          {stats.todaysBookings.length === 0 ? (
            <p className="custEmptyLine">Nothing on the books for today.</p>
          ) : (
            <div className="dashToday">
              {stats.todaysBookings.map((b) => (
                <div key={b.id} className={`dashAppt bk-${b.status}`}>
                  <span className="dashApptTime">{b.time}</span>
                  <span className="dashApptBody">
                    <span className="dashApptName">{b.name}</span>
                    {b.service && <span className="dashApptSvc">{b.service}</span>}
                  </span>
                  <span className={`calStatus bk-${b.status}`}>
                    {b.status === "confirmed" ? "Confirmed" : "Requested"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent leads */}
        <section className="dashPanel">
          <div className="dashPanelHead">
            <h2 className="dashPanelTitle">Recent leads</h2>
            <Link href="/admin/inbox" className="dashPanelLink">
              Inbox →
            </Link>
          </div>
          {stats.recentLeads.length === 0 ? (
            <p className="custEmptyLine">No leads yet.</p>
          ) : (
            <div className="dashLeads">
              {stats.recentLeads.map((l) => (
                <Link
                  key={l.id}
                  href={l.customerId ? `/admin/customers/${l.customerId}` : "/admin/inbox"}
                  className="dashLeadRow"
                >
                  <span
                    className={`adminChip ${
                      l.type === "booking" ? "adminChipBooking" : "adminChipContact"
                    }`}
                  >
                    {l.type === "booking" ? "Booking" : "Contact"}
                  </span>
                  <span className="dashLeadName">
                    {!l.readAt && <span className="adminUnreadDot" />}
                    {l.name}
                  </span>
                  <span className="dashLeadWhen">{fmtRelative(l.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
