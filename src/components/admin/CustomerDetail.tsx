"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminCustomer } from "@/lib/customers";
import type { AdminJob } from "@/lib/jobs";
import type { AdminLead } from "@/lib/leads";
import type { AdminQuote } from "@/lib/quotes";
import type { AdminPayment } from "@/lib/payments";
import type { JobStatus } from "@/lib/db/schema";
import { PhoneIcon, MailIcon } from "@/components/Icons";
import QuotesPanel from "./QuotesPanel";
import PaymentsPanel from "./PaymentsPanel";

/** Minimal customer shape used for merge / reassign target pickers. */
export type CustomerLite = { id: string; name: string; phone: string | null; email: string | null };

const JOB_STATUSES: JobStatus[] = [
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
  "cancelled",
];
const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  quoted: "Quoted",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

function money(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CustomerDetail({
  customer,
  leads,
  jobs: initialJobs,
  quotes,
  payments,
  lifetimeSpentCents,
  otherCustomers,
}: {
  customer: AdminCustomer;
  leads: AdminLead[];
  jobs: AdminJob[];
  quotes: AdminQuote[];
  payments: AdminPayment[];
  lifetimeSpentCents: number;
  otherCustomers: CustomerLite[];
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<AdminJob[]>(initialJobs);

  // ─── Editable customer card ────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    notes: customer.notes ?? "",
  });
  const [savingCust, setSavingCust] = useState(false);

  async function saveCustomer() {
    setSavingCust(true);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      // leave the editor open so nothing is lost
    } finally {
      setSavingCust(false);
    }
  }

  // ─── New job form ──────────────────────────────────────────────────────
  const [showNewJob, setShowNewJob] = useState(false);
  const [job, setJob] = useState({
    title: "",
    amountDollars: "",
    scheduledDate: "",
    scheduledTime: "",
    notes: "",
  });
  const [creating, setCreating] = useState(false);
  const [jobError, setJobError] = useState("");

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    if (!job.title.trim()) {
      setJobError("Give the job a title.");
      return;
    }
    setCreating(true);
    setJobError("");
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          title: job.title,
          amountDollars: job.amountDollars,
          scheduledDate: job.scheduledDate,
          scheduledTime: job.scheduledTime,
          notes: job.notes,
          address: customer.address,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not create job.");
      }
      setJob({ title: "", amountDollars: "", scheduledDate: "", scheduledTime: "", notes: "" });
      setShowNewJob(false);
      router.refresh();
    } catch (err) {
      setJobError(err instanceof Error ? err.message : "Could not create job.");
    } finally {
      setCreating(false);
    }
  }

  // ─── Job status transitions ────────────────────────────────────────────
  async function changeJobStatus(jobId: string, status: JobStatus) {
    const prev = jobs;
    setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, status } : j)));
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setJobs(prev); // rollback
    }
  }

  return (
    <div className="custDetail">
      {/* IDENTITY */}
      <section className="custPanel">
        <div className="custPanelHead">
          <div className="custIdentity">
            <h1 className="adminTitle" style={{ marginBottom: 4 }}>
              {customer.name}
            </h1>
            <p className="adminSub">Customer since {fmtDate(customer.createdAt)}</p>
          </div>
          {!editing && (
            <div className="custHeadActions">
              <button className="adminTab" onClick={() => setMerging((m) => !m)}>
                {merging ? "Close" : "Merge"}
              </button>
              <button className="adminTab" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="custSpend">
          <span className="custSpendLabel">Lifetime spend</span>
          <span className="custSpendNum">{money(lifetimeSpentCents)}</span>
        </div>

        {merging && (
          <MergePanel
            customerId={customer.id}
            otherCustomers={otherCustomers}
            onClose={() => setMerging(false)}
          />
        )}

        {!editing ? (
          <>
            <div className="adminActions" style={{ marginTop: 4 }}>
              {customer.phone && (
                <>
                  <a className="adminAction adminActionPrimary" href={`tel:${customer.phone}`}>
                    <PhoneIcon className="adminActionIcon" /> Call
                  </a>
                  <a className="adminAction" href={`sms:${customer.phone}`}>
                    <PhoneIcon className="adminActionIcon" /> Text
                  </a>
                </>
              )}
              {customer.email && (
                <a className="adminAction" href={`mailto:${customer.email}`}>
                  <MailIcon className="adminActionIcon" /> Email
                </a>
              )}
            </div>
            <div className="adminFields" style={{ marginTop: 18 }}>
              <Field label="Phone" value={customer.phone} />
              <Field label="Email" value={customer.email} />
              <Field label="Address" value={customer.address} full />
              {customer.notes && (
                <div className="adminFieldFull">
                  <p className="adminFieldLabel">Notes</p>
                  <p className="adminMessage">{customer.notes}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="custEdit">
            <EditRow label="Name">
              <input
                className="adminInput"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </EditRow>
            <EditRow label="Phone">
              <input
                className="adminInput"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </EditRow>
            <EditRow label="Email">
              <input
                className="adminInput"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </EditRow>
            <EditRow label="Address">
              <input
                className="adminInput"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </EditRow>
            <EditRow label="Notes">
              <textarea
                className="adminInput"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </EditRow>
            <div className="custEditActions">
              <button
                className="adminLoginBtn"
                style={{ marginTop: 0, width: "auto", padding: "12px 26px" }}
                onClick={saveCustomer}
                disabled={savingCust}
              >
                {savingCust ? "Saving…" : "Save"}
              </button>
              <button
                className="adminTab"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    name: customer.name,
                    phone: customer.phone ?? "",
                    email: customer.email ?? "",
                    address: customer.address ?? "",
                    notes: customer.notes ?? "",
                  });
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* JOBS */}
      <section className="custPanel">
        <div className="custPanelHead">
          <h2 className="custPanelTitle">
            Jobs <span className="custPanelCount">{jobs.length}</span>
          </h2>
          <button className="adminTab" onClick={() => setShowNewJob((s) => !s)}>
            {showNewJob ? "Close" : "+ New job"}
          </button>
        </div>

        {showNewJob && (
          <form className="jobForm" onSubmit={createJob}>
            <input
              className="adminInput"
              placeholder="Job title, e.g. Drywall patch + paint"
              value={job.title}
              onChange={(e) => setJob((j) => ({ ...j, title: e.target.value }))}
            />
            <div className="jobFormRow">
              <input
                className="adminInput"
                inputMode="decimal"
                placeholder="Quote $ (optional)"
                value={job.amountDollars}
                onChange={(e) => setJob((j) => ({ ...j, amountDollars: e.target.value }))}
              />
              <input
                className="adminInput"
                type="date"
                value={job.scheduledDate}
                onChange={(e) => setJob((j) => ({ ...j, scheduledDate: e.target.value }))}
              />
              <input
                className="adminInput"
                placeholder="Time, e.g. 9:00 AM"
                value={job.scheduledTime}
                onChange={(e) => setJob((j) => ({ ...j, scheduledTime: e.target.value }))}
              />
            </div>
            <textarea
              className="adminInput"
              rows={2}
              placeholder="Scope / notes (optional)"
              value={job.notes}
              onChange={(e) => setJob((j) => ({ ...j, notes: e.target.value }))}
            />
            {jobError && <p className="adminLoginError" style={{ margin: 0 }}>{jobError}</p>}
            <button
              className="adminLoginBtn"
              style={{ marginTop: 0, width: "auto", padding: "12px 26px" }}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create job"}
            </button>
          </form>
        )}

        {jobs.length === 0 ? (
          <p className="custEmptyLine">No jobs yet for this customer.</p>
        ) : (
          <div className="jobRows">
            {jobs.map((j) => (
              <div key={j.id} className="jobRow">
                <div className="jobRowMain">
                  <Link href={`/admin/jobs/${j.id}`} className="jobRowTitle">
                    {j.title}
                  </Link>
                  <span className="jobRowMeta">
                    {money(j.amountCents)}
                    {j.scheduledDate && ` · ${j.scheduledDate}`}
                    {j.scheduledTime && ` ${j.scheduledTime}`}
                  </span>
                  {j.notes && <span className="jobRowNotes">{j.notes}</span>}
                </div>
                <select
                  className={`jobStatusSelect js-${j.status}`}
                  value={j.status}
                  onChange={(e) => changeJobStatus(j.id, e.target.value as JobStatus)}
                >
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {JOB_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* QUOTES */}
      <QuotesPanel customerId={customer.id} quotes={quotes} />

      {/* PAYMENTS */}
      <PaymentsPanel customerId={customer.id} payments={payments} />

      {/* LEAD HISTORY */}
      <section className="custPanel">
        <h2 className="custPanelTitle">
          Lead history <span className="custPanelCount">{leads.length}</span>
        </h2>
        {leads.length === 0 ? (
          <p className="custEmptyLine">No leads linked to this customer.</p>
        ) : (
          <div className="leadHistory">
            {leads.map((l) => (
              <div key={l.id} className="leadHistRow">
                <span
                  className={`adminChip ${
                    l.type === "booking" ? "adminChipBooking" : "adminChipContact"
                  }`}
                >
                  {l.type === "booking" ? "Booking" : "Contact"}
                </span>
                <span className="leadHistText">
                  {l.type === "booking"
                    ? `${l.service ?? "Service"} · ${l.preferredDate ?? ""} ${l.preferredTime ?? ""}`
                    : l.message ?? ""}
                </span>
                <span className="leadHistWhen">{fmtDate(l.createdAt)}</span>
                {otherCustomers.length > 0 && (
                  <ReassignLead leadId={l.id} otherCustomers={otherCustomers} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Move a lead to another customer (the "<both> reassign" path). */
function ReassignLead({
  leadId,
  otherCustomers,
}: {
  leadId: string;
  otherCustomers: CustomerLite[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function move(customerId: string) {
    if (!customerId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      className="leadReassign"
      defaultValue=""
      disabled={busy}
      onChange={(e) => move(e.target.value)}
      aria-label="Move lead to another customer"
      title="Move to another customer"
    >
      <option value="" disabled>
        Move to…
      </option>
      {otherCustomers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.phone ? ` · ${c.phone}` : ""}
        </option>
      ))}
    </select>
  );
}

/** Merge another (duplicate) customer's records into this one. */
function MergePanel({
  customerId,
  otherCustomers,
  onClose,
}: {
  customerId: string;
  otherCustomers: CustomerLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return otherCustomers.slice(0, 6);
    return otherCustomers
      .filter((c) =>
        [c.name, c.phone, c.email]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(needle))
      )
      .slice(0, 8);
  }, [q, otherCustomers]);

  async function merge(duplicateId: string, name: string) {
    if (!confirm(`Merge "${name}" into this customer? Their leads, jobs, quotes, and payments move here and "${name}" is removed.`)) {
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not merge.");
      onClose();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not merge.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mergePanel">
      <p className="mergeHint">
        Pick the duplicate record to fold into this profile.
      </p>
      <input
        className="adminInput"
        placeholder="Search customers by name, phone, email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mergeResults">
        {matches.length === 0 ? (
          <p className="custEmptyLine">No other customers match.</p>
        ) : (
          matches.map((c) => (
            <button
              key={c.id}
              className="mergeResult"
              disabled={busy}
              onClick={() => merge(c.id, c.name)}
            >
              <span className="mergeResultName">{c.name}</span>
              <span className="mergeResultMeta">{c.phone || c.email || "—"}</span>
              <span className="mergeResultGo">Merge in →</span>
            </button>
          ))
        )}
      </div>
      {err && <p className="adminLoginError" style={{ margin: "4px 0 0" }}>{err}</p>}
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string | null; full?: boolean }) {
  return (
    <div className={full ? "adminFieldFull" : undefined}>
      <p className="adminFieldLabel">{label}</p>
      <p className={`adminFieldValue ${value ? "" : "muted"}`}>{value || "—"}</p>
    </div>
  );
}

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="custEditRow">
      <span className="adminFieldLabel">{label}</span>
      {children}
    </label>
  );
}
