"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminBooking, AdminBlock } from "@/lib/scheduling";
import type { BookingStatus } from "@/lib/db/schema";
import { fmtWeekday, fmtMonthDay, isToday } from "@/lib/date-utils";
import { ArrowIcon, CheckIcon } from "@/components/Icons";
import CalScopeMenu from "./CalScopeMenu";

const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

type Props = {
  days: string[];
  bookings: AdminBooking[];
  blocks: AdminBlock[];
  todayIso: string;
  prevWeek: string;
  nextWeek: string;
  weekScopeHref: string;
  monthScopeHref: string;
};

export default function BookingCalendar({
  days,
  bookings,
  blocks,
  todayIso,
  prevWeek,
  nextWeek,
  weekScopeHref,
  monthScopeHref,
}: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<Record<string, "busy" | "done">>({});
  const [showBlock, setShowBlock] = useState(false);
  const [blockDate, setBlockDate] = useState(days[0] ?? todayIso);
  const [blockTime, setBlockTime] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);

  const bookingsByDay = new Map<string, AdminBooking[]>();
  for (const b of bookings) {
    const arr = bookingsByDay.get(b.date) ?? [];
    arr.push(b);
    bookingsByDay.set(b.date, arr);
  }
  const blocksByDay = new Map<string, AdminBlock[]>();
  for (const b of blocks) {
    const arr = blocksByDay.get(b.date) ?? [];
    arr.push(b);
    blocksByDay.set(b.date, arr);
  }

  async function decide(id: string, status: BookingStatus) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function makeJob(id: string) {
    setJobState((s) => ({ ...s, [id]: "busy" }));
    try {
      const res = await fetch(`/api/admin/bookings/${id}/job`, { method: "POST" });
      if (!res.ok) throw new Error();
      setJobState((s) => ({ ...s, [id]: "done" }));
      router.refresh();
    } catch {
      setJobState((s) => {
        const next = { ...s };
        delete next[id];
        return next;
      });
    }
  }

  async function addBlock() {
    if (!blockDate) return;
    setBlockBusy(true);
    try {
      await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: blockDate,
          time: blockTime || undefined,
          reason: blockReason || undefined,
        }),
      });
      setBlockTime("");
      setBlockReason("");
      setShowBlock(false);
      router.refresh();
    } finally {
      setBlockBusy(false);
    }
  }

  async function removeBlock(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="calToolbar">
        <div className="calNavGroup">
          <Link href={`/admin/calendar?week=${prevWeek}`} className="calNavBtn" aria-label="Previous week">
            <ArrowIcon style={{ transform: "rotate(180deg)", width: 16, height: 16 }} />
          </Link>
          <CalScopeMenu scope="week" weekHref={weekScopeHref} monthHref={monthScopeHref} />
          <Link href={`/admin/calendar?week=${nextWeek}`} className="calNavBtn" aria-label="Next week">
            <ArrowIcon style={{ width: 16, height: 16 }} />
          </Link>
        </div>

        <button className="calBlockToggle" onClick={() => setShowBlock((s) => !s)}>
          {showBlock ? "Close" : "Block time off"}
        </button>
      </div>

      {showBlock && (
        <div className="calBlockForm">
          <div className="calBlockFields">
            <label className="calBlockField">
              <span>Date</span>
              <input
                type="date"
                className="adminInput"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
              />
            </label>
            <label className="calBlockField">
              <span>Time (blank = whole day)</span>
              <input
                type="text"
                className="adminInput"
                placeholder="e.g. 1:30 PM"
                value={blockTime}
                onChange={(e) => setBlockTime(e.target.value)}
              />
            </label>
            <label className="calBlockField">
              <span>Reason (optional)</span>
              <input
                type="text"
                className="adminInput"
                placeholder="Vacation, personal…"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </label>
          </div>
          <button className="adminLoginBtn calBlockAdd" onClick={addBlock} disabled={blockBusy}>
            {blockBusy ? "Adding…" : "Add block"}
          </button>
        </div>
      )}

      <div className="calGrid">
        {days.map((day) => {
          const dayBookings = (bookingsByDay.get(day) ?? []).filter(
            (b) => b.status === "requested" || b.status === "confirmed"
          );
          const pastBookings = (bookingsByDay.get(day) ?? []).filter(
            (b) => b.status === "declined" || b.status === "cancelled"
          );
          const dayBlocks = blocksByDay.get(day) ?? [];
          const today = isToday(day);
          return (
            <div key={day} className={`calCol ${today ? "calColToday" : ""}`}>
              <div className="calColHead">
                <span className="calColDow">{fmtWeekday(day)}</span>
                <span className="calColDate">{fmtMonthDay(day)}</span>
              </div>

              <div className="calColBody">
                {dayBlocks.map((bl) => (
                  <div key={bl.id} className="calBlock">
                    <div className="calBlockText">
                      <strong>{bl.time ? bl.time : "All day"}</strong>
                      <span>blocked{bl.reason ? ` · ${bl.reason}` : ""}</span>
                    </div>
                    <button
                      className="calBlockRemove"
                      onClick={() => removeBlock(bl.id)}
                      disabled={busyId === bl.id}
                      aria-label="Remove block"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {dayBookings.map((b) => (
                  <div key={b.id} className={`calBooking bk-${b.status}`}>
                    <div className="calBookingTop">
                      <span className="calBookingTime">{b.time}</span>
                      <span className={`calStatus bk-${b.status}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </div>
                    <div className="calBookingName">{b.name}</div>
                    {b.service && <div className="calBookingService">{b.service}</div>}
                    {(b.phone || b.email) && (
                      <div className="calBookingContact">{b.phone || b.email}</div>
                    )}
                    <div className="calBookingActions">
                      {b.status === "requested" && (
                        <>
                          <button
                            className="calAct calActConfirm"
                            onClick={() => decide(b.id, "confirmed")}
                            disabled={busyId === b.id}
                          >
                            <CheckIcon style={{ width: 14, height: 14 }} /> Confirm
                          </button>
                          <button
                            className="calAct calActDecline"
                            onClick={() => decide(b.id, "declined")}
                            disabled={busyId === b.id}
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {b.status === "confirmed" && (
                        <>
                          {jobState[b.id] === "done" ? (
                            <span className="calJobDone">✓ Job created</span>
                          ) : (
                            <button
                              className="calAct calActJob"
                              onClick={() => makeJob(b.id)}
                              disabled={jobState[b.id] === "busy"}
                            >
                              {jobState[b.id] === "busy" ? "Adding…" : "+ Job"}
                            </button>
                          )}
                          <button
                            className="calAct calActDecline"
                            onClick={() => decide(b.id, "cancelled")}
                            disabled={busyId === b.id}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {pastBookings.map((b) => (
                  <div key={b.id} className="calBooking bk-dim">
                    <div className="calBookingTop">
                      <span className="calBookingTime">{b.time}</span>
                      <span className={`calStatus bk-${b.status}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </div>
                    <div className="calBookingName">{b.name}</div>
                  </div>
                ))}

                {dayBookings.length === 0 &&
                  pastBookings.length === 0 &&
                  dayBlocks.length === 0 && <p className="calEmpty">—</p>}
              </div>
            </div>
          );
        })}
      </div>

      <p className="adminSub" style={{ marginTop: 16 }}>
        Tip: confirming a booking keeps its slot reserved; declining or cancelling
        frees it for someone else.
      </p>
    </>
  );
}
