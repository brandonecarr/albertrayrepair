"use client";

import Link from "next/link";
import type { AdminBooking, AdminBlock } from "@/lib/scheduling";
import { isToday, isSameMonth, startOfWeekIso, dayOfMonth } from "@/lib/date-utils";
import { ArrowIcon } from "@/components/Icons";
import CalScopeMenu from "./CalScopeMenu";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  days: string[];
  bookings: AdminBooking[];
  blocks: AdminBlock[];
  todayIso: string;
  monthAnchor: string;
  prevMonth: string;
  nextMonth: string;
  weekScopeHref: string;
  monthScopeHref: string;
};

export default function MonthCalendar({
  days,
  bookings,
  blocks,
  monthAnchor,
  prevMonth,
  nextMonth,
  weekScopeHref,
  monthScopeHref,
}: Props) {
  // Group active bookings + blocks by day.
  const bookingsByDay = new Map<string, AdminBooking[]>();
  for (const b of bookings) {
    if (b.status !== "requested" && b.status !== "confirmed") continue;
    const arr = bookingsByDay.get(b.date) ?? [];
    arr.push(b);
    bookingsByDay.set(b.date, arr);
  }
  const blocksByDay = new Map<string, AdminBlock[]>();
  for (const bl of blocks) {
    const arr = blocksByDay.get(bl.date) ?? [];
    arr.push(bl);
    blocksByDay.set(bl.date, arr);
  }

  return (
    <>
      <div className="calToolbar">
        <div className="calNavGroup">
          <Link href={prevMonth} className="calNavBtn" aria-label="Previous month">
            <ArrowIcon style={{ transform: "rotate(180deg)", width: 16, height: 16 }} />
          </Link>
          <CalScopeMenu scope="month" weekHref={weekScopeHref} monthHref={monthScopeHref} />
          <Link href={nextMonth} className="calNavBtn" aria-label="Next month">
            <ArrowIcon style={{ width: 16, height: 16 }} />
          </Link>
        </div>
      </div>

      <div className="calMonthScroll">
        <div className="calMonthInner">
          <div className="calMonthDow">
            {DOW.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="calMonthGrid">
            {days.map((day) => {
              const inMonth = isSameMonth(day, monthAnchor);
              const today = isToday(day);
              const dayBookings = bookingsByDay.get(day) ?? [];
              const dayBlocks = blocksByDay.get(day) ?? [];
              const shown = dayBookings.slice(0, 3);
              const extra = dayBookings.length - shown.length;
              return (
                <Link
                  key={day}
                  href={`/admin/calendar?view=week&week=${startOfWeekIso(day)}`}
                  className={`calCell ${inMonth ? "" : "calCellOut"} ${
                    today ? "calCellToday" : ""
                  }`}
                  aria-label={`Open week of ${day}`}
                >
                  <span className="calCellNum">{dayOfMonth(day)}</span>
                  <div className="calCellItems">
                    {dayBlocks.map((bl) => (
                      <span key={bl.id} className="calCellBlock">
                        {bl.time ? bl.time : "All day"} off
                      </span>
                    ))}
                    {shown.map((b) => (
                      <span key={b.id} className={`calCellEvent ev-${b.status}`}>
                        <span className="calCellDot" />
                        <span className="calCellEventText">
                          {b.time} · {b.name}
                        </span>
                      </span>
                    ))}
                    {extra > 0 && <span className="calCellMore">+{extra} more</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <p className="adminSub" style={{ marginTop: 16 }}>
        Tip: click any day to jump to that week, where you can confirm, decline,
        or block time.
      </p>
    </>
  );
}
