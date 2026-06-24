"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminJob, AdminJobNote } from "@/lib/jobs";
import type { AdminMaterial } from "@/lib/materials";
import type { JobStatus, MaterialPurchaser } from "@/lib/db/schema";
import { startOfWeekIso } from "@/lib/date-utils";
import MaterialAutocomplete from "./MaterialAutocomplete";

const STATUSES: JobStatus[] = [
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
  "cancelled",
];
const LABELS: Record<JobStatus, string> = {
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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function JobDetail({
  job: initial,
  initialNotes,
  initialMaterials,
}: {
  job: AdminJob;
  initialNotes: AdminJobNote[];
  initialMaterials: AdminMaterial[];
}) {
  const router = useRouter();
  const [job, setJob] = useState<AdminJob>(initial);
  const [editing, setEditing] = useState(false);

  // Notes log
  const [notes, setNotes] = useState<AdminJobNote[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.note) {
        setNotes((n) => [data.note, ...n]);
        setDraft("");
      }
    } finally {
      setAddingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    const prev = notes;
    setNotes((n) => n.filter((x) => x.id !== noteId));
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/notes/${noteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setNotes(prev); // rollback
    }
  }

  // Materials
  const [materials, setMaterials] = useState<AdminMaterial[]>(initialMaterials);
  const [matName, setMatName] = useState("");
  const [matPrice, setMatPrice] = useState("");
  const [matPurchaser, setMatPurchaser] = useState<MaterialPurchaser>("company");
  const [addingMat, setAddingMat] = useState(false);

  const companyCents = materials
    .filter((m) => m.purchaser === "company")
    .reduce((s, m) => s + m.priceCents, 0);
  const clientCents = materials
    .filter((m) => m.purchaser === "client")
    .reduce((s, m) => s + m.priceCents, 0);

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!matName.trim()) return;
    setAddingMat(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: matName,
          priceDollars: matPrice,
          purchaser: matPurchaser,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.material) {
        setMaterials((m) => [data.material, ...m]);
        setMatName("");
        setMatPrice("");
      }
    } finally {
      setAddingMat(false);
    }
  }

  async function deleteMaterial(matId: string) {
    const prev = materials;
    setMaterials((m) => m.filter((x) => x.id !== matId));
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/materials/${matId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setMaterials(prev); // rollback
    }
  }
  const [form, setForm] = useState({
    title: initial.title,
    amountDollars: initial.amountCents != null ? (initial.amountCents / 100).toString() : "",
    scheduledDate: initial.scheduledDate ?? "",
    scheduledTime: initial.scheduledTime ?? "",
    address: initial.address ?? "",
    notes: initial.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function changeStatus(status: JobStatus) {
    const prev = job.status;
    setJob((j) => ({ ...j, status }));
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setJob((j) => ({ ...j, status: prev })); // rollback
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          amountDollars: form.amountDollars,
          scheduledDate: form.scheduledDate,
          scheduledTime: form.scheduledTime,
          address: form.address,
          notes: form.notes,
        }),
      });
      if (!res.ok) throw new Error();
      setJob((j) => ({
        ...j,
        title: form.title.trim() || j.title,
        amountCents: form.amountDollars ? Math.round(Number(form.amountDollars) * 100) : null,
        scheduledDate: form.scheduledDate || null,
        scheduledTime: form.scheduledTime || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      }));
      setEditing(false);
      router.refresh();
    } catch {
      // leave the editor open
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="custDetail">
      <section className="custPanel">
        <div className="custPanelHead">
          <div className="custIdentity">
            <h1 className="adminTitle" style={{ marginBottom: 4 }}>
              {job.title}
            </h1>
            <p className="adminSub">
              {job.customerName ? (
                <>
                  For{" "}
                  <Link
                    href={`/admin/customers/${job.customerId}`}
                    className="adminCustLink"
                    style={{ marginTop: 0 }}
                  >
                    {job.customerName}
                  </Link>
                </>
              ) : (
                "Job"
              )}
              {" · created "}
              {fmtDate(job.createdAt)}
            </p>
          </div>
          <div className="custHeadActions">
            <select
              className={`jobStatusSelect js-${job.status}`}
              value={job.status}
              onChange={(e) => changeStatus(e.target.value as JobStatus)}
              aria-label="Job status"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LABELS[s]}
                </option>
              ))}
            </select>
            {!editing && (
              <button className="adminTab" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="custSpend">
          <span className="custSpendLabel">Amount</span>
          <span className="custSpendNum">{money(job.amountCents)}</span>
        </div>

        {!editing ? (
          <>
            <div className="adminActions" style={{ marginTop: 4 }}>
              {job.customerId && (
                <Link
                  href={`/admin/customers/${job.customerId}`}
                  className="adminAction adminActionPrimary"
                >
                  View customer →
                </Link>
              )}
              {job.scheduledDate && (
                <Link
                  href={`/admin/calendar?week=${startOfWeekIso(job.scheduledDate)}`}
                  className="adminAction"
                >
                  On calendar →
                </Link>
              )}
            </div>
            <div className="adminFields" style={{ marginTop: 18 }}>
              <Field
                label="Scheduled"
                value={
                  job.scheduledDate
                    ? `${job.scheduledDate}${job.scheduledTime ? ` · ${job.scheduledTime}` : ""}`
                    : null
                }
              />
              <Field label="Status" value={LABELS[job.status]} />
              <Field label="Address" value={job.address} full />
              {job.notes && (
                <div className="adminFieldFull">
                  <p className="adminFieldLabel">Details</p>
                  <p className="adminMessage">{job.notes}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="custEdit">
            <EditRow label="Title">
              <input
                className="adminInput"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </EditRow>
            <EditRow label="Amount ($)">
              <input
                className="adminInput"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amountDollars}
                onChange={(e) => setForm((f) => ({ ...f, amountDollars: e.target.value }))}
              />
            </EditRow>
            <div className="jobFormRow">
              <EditRow label="Date">
                <input
                  className="adminInput"
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                />
              </EditRow>
              <EditRow label="Time">
                <input
                  className="adminInput"
                  placeholder="9:00 AM"
                  value={form.scheduledTime}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                />
              </EditRow>
            </div>
            <EditRow label="Address">
              <input
                className="adminInput"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </EditRow>
            <EditRow label="Details">
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
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                className="adminTab"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    title: job.title,
                    amountDollars: job.amountCents != null ? (job.amountCents / 100).toString() : "",
                    scheduledDate: job.scheduledDate ?? "",
                    scheduledTime: job.scheduledTime ?? "",
                    address: job.address ?? "",
                    notes: job.notes ?? "",
                  });
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="custPanel">
        <div className="custPanelHead">
          <h2 className="custPanelTitle">
            Materials <span className="custPanelCount">{materials.length}</span>
          </h2>
          {(companyCents > 0 || clientCents > 0) && (
            <div className="matTotals">
              <span className="matTotalCo">Company {money(companyCents)}</span>
              <span className="matTotalCl">Client {money(clientCents)}</span>
            </div>
          )}
        </div>

        <form className="matAdd" onSubmit={addMaterial}>
          <div className="matNameField">
            <MaterialAutocomplete
              value={matName}
              onChangeName={setMatName}
              onPick={(s) => {
                setMatName(s.name);
                setMatPrice((s.priceCents / 100).toString());
              }}
              placeholder="Material — e.g. Drywall screws"
            />
          </div>
          <span className="matPriceWrap">
            <span className="matPricePrefix">$</span>
            <input
              className="adminInput matPriceInput"
              inputMode="decimal"
              placeholder="0.00"
              value={matPrice}
              onChange={(e) => setMatPrice(e.target.value)}
            />
          </span>
          <select
            className="matPurchaser"
            value={matPurchaser}
            onChange={(e) => setMatPurchaser(e.target.value as MaterialPurchaser)}
            aria-label="Who purchased"
          >
            <option value="company">Company purchased</option>
            <option value="client">Client purchased</option>
          </select>
          <button
            className="adminLoginBtn"
            style={{ marginTop: 0, width: "auto", padding: "12px 22px" }}
            disabled={addingMat || !matName.trim()}
          >
            {addingMat ? "Adding…" : "Add"}
          </button>
        </form>

        {materials.length === 0 ? (
          <p className="custEmptyLine">No materials logged yet.</p>
        ) : (
          <ul className="matList">
            {materials.map((m) => (
              <li key={m.id} className="matItem">
                <span className="matName">{m.name}</span>
                <span className="matItemPrice">{money(m.priceCents)}</span>
                <span className={`matTag mat-${m.purchaser}`}>
                  {m.purchaser === "company" ? "Company" : "Client"}
                </span>
                <button
                  type="button"
                  className="jobNoteDel"
                  onClick={() => deleteMaterial(m.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="custPanel">
        <div className="custPanelHead">
          <h2 className="custPanelTitle">
            Notes <span className="custPanelCount">{notes.length}</span>
          </h2>
        </div>

        <form className="jobNoteAdd" onSubmit={addNote}>
          <textarea
            className="adminInput jobNoteInput"
            rows={2}
            placeholder="Add a note or update…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="adminLoginBtn"
            style={{ marginTop: 0, width: "auto", padding: "12px 24px" }}
            disabled={addingNote || !draft.trim()}
          >
            {addingNote ? "Adding…" : "Add note"}
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="custEmptyLine">No notes yet.</p>
        ) : (
          <ul className="jobNoteList">
            {notes.map((n) => (
              <li key={n.id} className="jobNote">
                <p className="jobNoteBody">{n.body}</p>
                <div className="jobNoteFoot">
                  <span className="jobNoteWhen">{fmtDateTime(n.createdAt)}</span>
                  <button
                    type="button"
                    className="jobNoteDel"
                    onClick={() => deleteNote(n.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
