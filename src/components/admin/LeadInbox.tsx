"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminLead } from "@/lib/leads";
import type { LeadStatus } from "@/lib/db/schema";
import { startOfWeekIso } from "@/lib/date-utils";
import { PhoneIcon, MailIcon, CalendarIcon } from "@/components/Icons";

const STATUSES: LeadStatus[] = ["new", "contacted", "won", "lost"];
const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  won: "Won",
  lost: "Lost",
};

type Filter = "all" | LeadStatus;

function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtFull(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusChip({ status }: { status: LeadStatus }) {
  return (
    <span className={`adminStatus status-${status}`}>
      <span className="adminStatusDot" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function LeadInbox({ initialLeads }: { initialLeads: AdminLead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState<AdminLead[]>(initialLeads);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialLeads[0]?.id ?? null
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<Record<string, "creating" | "done">>({});
  const [jobError, setJobError] = useState<{ id: string; msg: string } | null>(null);

  async function createJob(lead: AdminLead) {
    setJobState((s) => ({ ...s, [lead.id]: "creating" }));
    setJobError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/job`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create the job.");
      // The lead converts to "won".
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: "won" } : l))
      );
      if (data.onCalendar && data.date) {
        // Land on the calendar week so the new appointment is visible.
        router.push(`/admin/calendar?week=${startOfWeekIso(data.date)}`);
      } else {
        setJobState((s) => ({ ...s, [lead.id]: "done" }));
      }
    } catch (err) {
      setJobState((s) => {
        const next = { ...s };
        delete next[lead.id];
        return next;
      });
      setJobError({ id: lead.id, msg: err instanceof Error ? err.message : "Could not create the job." });
    }
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: leads.length, new: 0, contacted: 0, won: 0, lost: 0 };
    for (const l of leads) c[l.status] += 1;
    return c;
  }, [leads]);

  const visible = useMemo(
    () => (filter === "all" ? leads : leads.filter((l) => l.status === filter)),
    [leads, filter]
  );

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  async function openLead(lead: AdminLead) {
    setSelectedId(lead.id);
    if (!lead.readAt) {
      // Optimistic mark-read.
      const nowIso = new Date().toISOString();
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, readAt: nowIso } : l))
      );
      fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markRead: true }),
      }).catch(() => {});
    }
  }

  async function changeStatus(lead: AdminLead, status: LeadStatus) {
    if (lead.status === status) return;
    const prevStatus = lead.status;
    setSavingId(lead.id);
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status } : l))
    );
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Roll back on failure.
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: prevStatus } : l))
      );
    } finally {
      setSavingId(null);
    }
  }

  if (leads.length === 0) {
    return (
      <div className="adminEmpty">
        <div>
          <p className="adminEmptyTitle">No leads yet</p>
          <p>New booking requests and contact messages will show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="adminTabs">
        {(["all", ...STATUSES] as Filter[]).map((f) => (
          <button
            key={f}
            className={`adminTab ${filter === f ? "adminTabActive" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : STATUS_LABEL[f]}
            <span className="adminTabCount">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="adminSplit">
        {/* MASTER */}
        <div className="adminList">
          {visible.length === 0 ? (
            <div className="adminEmpty" style={{ minHeight: 160 }}>
              <p>No {filter !== "all" ? STATUS_LABEL[filter as LeadStatus].toLowerCase() : ""} leads.</p>
            </div>
          ) : (
            visible.map((l) => {
              const isActive = l.id === selectedId;
              const unread = !l.readAt;
              return (
                <button
                  key={l.id}
                  onClick={() => openLead(l)}
                  className={`adminCard ${isActive ? "adminCardActive" : ""} ${
                    unread && !isActive ? "adminCardUnread" : ""
                  }`}
                >
                  <div className="adminCardTop">
                    <span className="adminCardName">
                      {unread && <span className="adminUnreadDot" />}
                      {l.name}
                    </span>
                    <span className="adminCardTime">{fmtRelative(l.createdAt)}</span>
                  </div>
                  <div className="adminCardTop" style={{ marginBottom: 0 }}>
                    <span
                      className={`adminChip ${
                        l.type === "booking" ? "adminChipBooking" : "adminChipContact"
                      }`}
                    >
                      {l.type === "booking" ? "Booking" : "Contact"}
                    </span>
                    <StatusChip status={l.status} />
                  </div>
                  <div className="adminCardMeta" style={{ marginTop: 8 }}>
                    {l.type === "booking"
                      ? `${l.service ?? "Service"} · ${l.preferredDate ?? ""} ${l.preferredTime ?? ""}`
                      : l.message ?? ""}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* DETAIL */}
        {selected ? (
          <article className="adminDetail" key={selected.id}>
            <div className="adminDetailHead">
              <div className="adminDetailTopRow">
                <span
                  className={`adminChip ${
                    selected.type === "booking" ? "adminChipBooking" : "adminChipContact"
                  }`}
                >
                  {selected.type === "booking" ? "Booking Request" : "Contact Message"}
                </span>
                <StatusChip status={selected.status} />
              </div>
              <h2 className="adminDetailName">{selected.name}</h2>
              <p className="adminDetailWhen">Received {fmtFull(selected.createdAt)}</p>
              {selected.customerId && (
                <Link
                  href={`/admin/customers/${selected.customerId}`}
                  className="adminCustLink"
                >
                  View customer record →
                </Link>
              )}
            </div>

            <div className="adminDetailBody">
              <div className="adminActions">
                {selected.phone && (
                  <>
                    <a className="adminAction adminActionPrimary" href={`tel:${selected.phone}`}>
                      <PhoneIcon className="adminActionIcon" /> Call
                    </a>
                    <a className="adminAction" href={`sms:${selected.phone}`}>
                      <PhoneIcon className="adminActionIcon" /> Text
                    </a>
                  </>
                )}
                {selected.email && (
                  <a className="adminAction" href={`mailto:${selected.email}`}>
                    <MailIcon className="adminActionIcon" /> Email
                  </a>
                )}
              </div>

              <div className="adminConvert">
                {jobState[selected.id] === "done" ? (
                  <p className="adminConvertDone">
                    ✓ Job created.{" "}
                    <Link href="/admin/jobs" className="adminCustLink" style={{ marginTop: 0 }}>
                      View on Jobs board →
                    </Link>
                  </p>
                ) : (
                  <button
                    className="adminConvertBtn"
                    onClick={() => createJob(selected)}
                    disabled={jobState[selected.id] === "creating"}
                  >
                    <CalendarIcon className="adminActionIcon" />
                    {jobState[selected.id] === "creating"
                      ? "Creating…"
                      : selected.preferredDate
                        ? "Create job & add to calendar"
                        : "Create job"}
                  </button>
                )}
                {jobError?.id === selected.id && (
                  <p className="field-error" style={{ marginTop: 8 }}>{jobError.msg}</p>
                )}
              </div>

              <div className="adminFields">
                {selected.type === "booking" && (
                  <>
                    <Field label="Service" value={selected.service} full />
                    <Field
                      label="Preferred date"
                      value={selected.preferredDate}
                    />
                    <Field label="Preferred time" value={selected.preferredTime} />
                    <Field label="Address" value={selected.address} full />
                  </>
                )}
                <Field label="Phone" value={selected.phone} />
                <Field label="Email" value={selected.email} />
                {selected.message && (
                  <div className="adminFieldFull">
                    <p className="adminFieldLabel">
                      {selected.type === "booking" ? "Notes" : "Message"}
                    </p>
                    <p className="adminMessage">{selected.message}</p>
                  </div>
                )}
              </div>

              <div className="adminWorkflow">
                <p className="adminWorkflowLabel">Pipeline status</p>
                <div className="adminStatusBtns">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      className={`adminStatusBtn ${
                        selected.status === s ? "adminStatusBtnActive" : ""
                      }`}
                      disabled={savingId === selected.id}
                      onClick={() => changeStatus(selected, s)}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ) : (
          <div className="adminDetailEmpty">Select a lead to view details.</div>
        )}
      </div>
    </>
  );
}

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: string | null;
  full?: boolean;
}) {
  return (
    <div className={full ? "adminFieldFull" : undefined}>
      <p className="adminFieldLabel">{label}</p>
      <p className={`adminFieldValue ${value ? "" : "muted"}`}>{value || "—"}</p>
    </div>
  );
}
