import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { getReport, type ReportData } from "@/lib/reports";
import { businessNowParts, businessWallTimeToUtc } from "@/lib/timezone";
import AdminTopBar from "@/components/admin/AdminTopBar";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "this-year", label: "This year" },
  { key: "12-months", label: "Last 12 mo" },
  { key: "all", label: "All time" },
] as const;

function resolveRange(range: string): { from: Date; to: Date; label: string } {
  const now = new Date();
  const { year, month } = businessNowParts(now); // month is 1-12, business-local

  // Midnight on the 1st of a given business-local month, as an absolute instant.
  const monthStart = (y: number, m1: number) => {
    const yy = y + Math.floor((m1 - 1) / 12);
    const mm = ((((m1 - 1) % 12) + 12) % 12) + 1;
    return businessWallTimeToUtc(yy, mm, 1, 0, 0, 0);
  };

  switch (range) {
    case "last-month":
      return {
        from: monthStart(year, month - 1),
        to: new Date(monthStart(year, month).getTime() - 1),
        label: "Last month",
      };
    case "this-year":
      return { from: monthStart(year, 1), to: now, label: "This year" };
    case "12-months":
      return { from: monthStart(year, month - 11), to: now, label: "Last 12 months" };
    case "all":
      return { from: new Date(0), to: now, label: "All time" };
    case "this-month":
    default:
      return { from: monthStart(year, month), to: now, label: "This month" };
  }
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const rangeKey = RANGES.some((r) => r.key === sp.range) ? sp.range! : "this-month";
  const { from, to, label } = resolveRange(rangeKey);
  const data: ReportData = await getReport(from, to);

  const maxMonth = Math.max(1, ...data.revenueByMonth.map((m) => m.cents));
  const maxCust = Math.max(1, ...data.topCustomers.map((c) => c.cents));

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminHead">
          <div>
            <h1 className="adminTitle">
              Reports <span className="accent">&amp; KPIs</span>
            </h1>
            <p className="adminSub">{label} · profit, performance, and pipeline.</p>
          </div>
          <div className="reportRange">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/admin/reports?range=${r.key}`}
                className={`reportRangeBtn ${r.key === rangeKey ? "reportRangeActive" : ""}`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>

        {!isDbConfigured ? (
          <div className="adminEmpty">
            <div>
              <p className="adminEmptyTitle">Database not connected</p>
              <p>
                Connect <code>DATABASE_URL</code> to run reports on your jobs,
                materials, and payments.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* P&L */}
            <section className="reportPnl">
              <div className="pnlItem">
                <span className="pnlLabel">Revenue</span>
                <span className="pnlValue pnlPos">{money(data.revenueCents)}</span>
                <span className="pnlNote">{data.completedJobs} completed jobs</span>
              </div>
              <span className="pnlOp">−</span>
              <div className="pnlItem">
                <span className="pnlLabel">Material cost</span>
                <span className="pnlValue pnlNeg">{money(data.materialCostCents)}</span>
                <span className="pnlNote">company-purchased</span>
              </div>
              <span className="pnlOp">=</span>
              <div className="pnlItem pnlItemTotal">
                <span className="pnlLabel">Gross profit</span>
                <span className="pnlValue">{money(data.grossProfitCents)}</span>
                <span className="pnlNote">{data.marginPct}% margin</span>
              </div>
            </section>

            {/* KPIs */}
            <div className="dashStats reportKpis">
              <Kpi value={money(data.avgJobValueCents)} label="Avg job value" />
              <Kpi value={money(data.paymentsCollectedCents)} label="Payments collected" />
              <Kpi value={money(data.pipelineCents)} label="Open pipeline" note={`${data.pipelineJobs} jobs · now`} />
              <Kpi value={String(data.newCustomers)} label="New customers" />
              <Kpi value={String(data.newLeads)} label="New leads" />
              <Kpi value={`${data.conversionPct}%`} label="Lead conversion" note={`${data.wonLeads} won`} />
            </div>

            <div className="reportCols">
              {/* Revenue by month */}
              <section className="custPanel">
                <div className="custPanelHead">
                  <h2 className="custPanelTitle">Revenue by month</h2>
                </div>
                {data.revenueByMonth.length === 0 ? (
                  <p className="custEmptyLine">No completed jobs in this range.</p>
                ) : (
                  <div className="revBars">
                    {data.revenueByMonth.map((m) => (
                      <div key={m.month} className="revBarRow">
                        <span className="revBarMonth">{monthLabel(m.month)}</span>
                        <span className="revBarTrack">
                          <span
                            className="revBarFill"
                            style={{ width: `${Math.max(3, (m.cents / maxMonth) * 100)}%` }}
                          />
                        </span>
                        <span className="revBarVal">{money(m.cents)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Top customers */}
              <section className="custPanel">
                <div className="custPanelHead">
                  <h2 className="custPanelTitle">Top customers</h2>
                </div>
                {data.topCustomers.length === 0 ? (
                  <p className="custEmptyLine">No revenue in this range.</p>
                ) : (
                  <div className="revBars">
                    {data.topCustomers.map((c) => (
                      <Link key={c.id} href={`/admin/customers/${c.id}`} className="revBarRow revBarLink">
                        <span className="revBarMonth revBarName">{c.name}</span>
                        <span className="revBarTrack">
                          <span
                            className="revBarFill revBarFillBlue"
                            style={{ width: `${Math.max(3, (c.cents / maxCust) * 100)}%` }}
                          />
                        </span>
                        <span className="revBarVal">{money(c.cents)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Lead funnel */}
            <section className="custPanel">
              <div className="custPanelHead">
                <h2 className="custPanelTitle">Lead funnel</h2>
                <span className="adminSub" style={{ marginTop: 0 }}>{label}</span>
              </div>
              <div className="funnelRow">
                <Funnel value={data.newLeads} label="New leads" />
                <Funnel value={data.wonLeads} label="Won" tone="win" />
                <Funnel value={data.lostLeads} label="Lost" tone="lose" />
                <Funnel value={`${data.conversionPct}%`} label="Conversion" />
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Kpi({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="dashStat">
      <span className="dashStatNum">{value}</span>
      <span className="dashStatLabel">{label}</span>
      {note && <span className="dashStatNote">{note}</span>}
    </div>
  );
}

function Funnel({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: "win" | "lose";
}) {
  return (
    <div className="funnelItem">
      <span className={`funnelNum ${tone === "win" ? "funnelWin" : tone === "lose" ? "funnelLose" : ""}`}>
        {value}
      </span>
      <span className="funnelLabel">{label}</span>
    </div>
  );
}
