import { isDbConfigured } from "@/lib/db";
import { listBookingsBetween, listBlocksBetween } from "@/lib/scheduling";
import { getJobLinksForBookings } from "@/lib/jobs";
import {
  startOfWeekIso,
  weekDates,
  addDays,
  fmtRange,
  startOfMonthIso,
  addMonths,
  monthGridDays,
  fmtMonthYear,
} from "@/lib/date-utils";
import { businessTodayIso } from "@/lib/timezone";
import AdminTopBar from "@/components/admin/AdminTopBar";
import BookingCalendar from "@/components/admin/BookingCalendar";
import MonthCalendar from "@/components/admin/MonthCalendar";

export const dynamic = "force-dynamic";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; month?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const todayIso = businessTodayIso();
  const isMonth = sp.view === "month";

  // Scope-dropdown targets: jump to the current week / current month.
  const weekScopeHref = `/admin/calendar?view=week&week=${startOfWeekIso(todayIso)}`;
  const monthScopeHref = `/admin/calendar?view=month&month=${startOfMonthIso(todayIso)}`;

  // ─── Month view ──────────────────────────────────────────────────────────
  if (isMonth) {
    const monthAnchor =
      sp.month && ISO_RE.test(sp.month)
        ? startOfMonthIso(sp.month)
        : startOfMonthIso(todayIso);

    const days = monthGridDays(monthAnchor);
    const rangeStart = days[0]!;
    const rangeEnd = days[days.length - 1]!;

    const [bookings, blocks] = await Promise.all([
      listBookingsBetween(rangeStart, rangeEnd),
      listBlocksBetween(rangeStart, rangeEnd),
    ]);

    return (
      <>
        <AdminTopBar />
        <main className="adminMain">
          <div className="adminHead">
            <div>
              <h1 className="adminTitle">
                Month <span className="accent">Calendar</span>
              </h1>
              <p className="adminSub">{fmtMonthYear(monthAnchor)}</p>
            </div>
          </div>

          {!isDbConfigured ? (
            <DbNotice />
          ) : (
            <MonthCalendar
              days={days}
              bookings={bookings}
              blocks={blocks}
              todayIso={todayIso}
              monthAnchor={monthAnchor}
              prevMonth={`/admin/calendar?view=month&month=${addMonths(monthAnchor, -1)}`}
              nextMonth={`/admin/calendar?view=month&month=${addMonths(monthAnchor, 1)}`}
              weekScopeHref={weekScopeHref}
              monthScopeHref={monthScopeHref}
            />
          )}
        </main>
      </>
    );
  }

  // ─── Week view (default) ───────────────────────────────────────────────────
  const weekStart =
    sp.week && ISO_RE.test(sp.week)
      ? startOfWeekIso(sp.week)
      : startOfWeekIso(todayIso);

  const days = weekDates(weekStart);
  const weekEnd = days[6]!;

  const [bookings, blocks] = await Promise.all([
    listBookingsBetween(weekStart, weekEnd),
    listBlocksBetween(weekStart, weekEnd),
  ]);
  const jobLinks = await getJobLinksForBookings(bookings.map((b) => b.id));

  return (
    <>
      <AdminTopBar />
      <main className="adminMain">
        <div className="adminHead">
          <div>
            <h1 className="adminTitle">
              Week <span className="accent">Calendar</span>
            </h1>
            <p className="adminSub">{fmtRange(weekStart, weekEnd)}</p>
          </div>
        </div>

        {!isDbConfigured ? (
          <DbNotice />
        ) : (
          <BookingCalendar
            days={days}
            bookings={bookings}
            blocks={blocks}
            todayIso={todayIso}
            prevWeek={addDays(weekStart, -7)}
            nextWeek={addDays(weekStart, 7)}
            weekScopeHref={weekScopeHref}
            monthScopeHref={monthScopeHref}
            jobLinks={jobLinks}
          />
        )}
      </main>
    </>
  );
}

function DbNotice() {
  return (
    <div className="adminEmpty">
      <div>
        <p className="adminEmptyTitle">Database not connected</p>
        <p>
          Connect <code>DATABASE_URL</code> to schedule and approve bookings.
        </p>
      </div>
    </div>
  );
}
