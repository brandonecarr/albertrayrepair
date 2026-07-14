"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminJob, AdminJobNote } from "@/lib/jobs";
import type { AdminMaterial } from "@/lib/materials";
import type { AdminQuote } from "@/lib/quotes";
import type { JobStatus, MaterialPurchaser } from "@/lib/db/schema";
import { startOfWeekIso } from "@/lib/date-utils";
import { dollarsToCentsStrict } from "@/lib/money";
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

// Preset stores for material purchases; "Other" reveals a write-in field.
const MATERIAL_STORES = ["Home Depot", "Lowe's", "Ace Hardware"];
const STORE_OTHER = "__other__";

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
  initialQuotes,
}: {
  job: AdminJob;
  initialNotes: AdminJobNote[];
  initialMaterials: AdminMaterial[];
  initialQuotes: AdminQuote[];
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

  // Materials (add/edit happen in a modal)
  const [materials, setMaterials] = useState<AdminMaterial[]>(initialMaterials);
  const [matModalOpen, setMatModalOpen] = useState(false);
  const [matEditingId, setMatEditingId] = useState<string | null>(null);
  const [matName, setMatName] = useState("");
  const [matPrice, setMatPrice] = useState("");
  const [matPurchaser, setMatPurchaser] = useState<MaterialPurchaser>("company");
  const [matStore, setMatStore] = useState("");
  const [matStoreCustom, setMatStoreCustom] = useState("");
  const [savingMat, setSavingMat] = useState(false);
  const [matError, setMatError] = useState<string | null>(null);

  const companyCents = materials
    .filter((m) => m.purchaser === "company")
    .reduce((s, m) => s + m.priceCents, 0);
  const clientCents = materials
    .filter((m) => m.purchaser === "client")
    .reduce((s, m) => s + m.priceCents, 0);

  function setStoreFromValue(store: string | null) {
    if (!store) {
      setMatStore("");
      setMatStoreCustom("");
    } else if (MATERIAL_STORES.includes(store)) {
      setMatStore(store);
      setMatStoreCustom("");
    } else {
      setMatStore(STORE_OTHER);
      setMatStoreCustom(store);
    }
  }

  function openAddMaterial() {
    setMatEditingId(null);
    setMatName("");
    setMatPrice("");
    setMatPurchaser("company");
    setMatStore("");
    setMatStoreCustom("");
    setMatError(null);
    setMatModalOpen(true);
  }

  function openEditMaterial(m: AdminMaterial) {
    setMatEditingId(m.id);
    setMatName(m.name);
    setMatPrice(m.priceCents ? (m.priceCents / 100).toString() : "");
    setMatPurchaser(m.purchaser);
    setStoreFromValue(m.store);
    setMatError(null);
    setMatModalOpen(true);
  }

  async function saveMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!matName.trim()) return;
    setSavingMat(true);
    setMatError(null);
    try {
      const store = matStore === STORE_OTHER ? matStoreCustom.trim() : matStore;
      const url = matEditingId
        ? `/api/admin/jobs/${job.id}/materials/${matEditingId}`
        : `/api/admin/jobs/${job.id}/materials`;
      const res = await fetch(url, {
        method: matEditingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: matName,
          priceDollars: matPrice,
          purchaser: matPurchaser,
          store: store || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.material) {
        setMaterials((m) =>
          matEditingId
            ? m.map((x) => (x.id === matEditingId ? data.material : x))
            : [data.material, ...m]
        );
        setMatModalOpen(false);
      } else {
        setMatError(data.error || "Couldn't save that material. Check the price and try again.");
      }
    } catch {
      setMatError("Couldn't save that material. Please try again.");
    } finally {
      setSavingMat(false);
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

  // Quotes / invoices for this job
  const [quotes, setQuotes] = useState<AdminQuote[]>(initialQuotes);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  async function createInvoice() {
    setCreatingInvoice(true);
    setInvoiceError(null);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/invoice`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.quote) {
        setQuotes((q) => [data.quote, ...q]);
        router.refresh(); // keep the customer page's quotes in sync
      } else {
        setInvoiceError(data.error || "Couldn't create the invoice. Please try again.");
      }
    } catch {
      setInvoiceError("Couldn't create the invoice. Please try again.");
    } finally {
      setCreatingInvoice(false);
    }
  }
  const [form, setForm] = useState({
    title: initial.title,
    amountDollars: initial.amountCents != null ? (initial.amountCents / 100).toString() : "",
    discountDollars: initial.discountCents != null ? (initial.discountCents / 100).toString() : "",
    scheduledDate: initial.scheduledDate ?? "",
    scheduledTime: initial.scheduledTime ?? "",
    address: initial.address ?? "",
    notes: initial.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    // Validate the money fields client-side so a typo doesn't silently fail.
    const trimmedAmount = form.amountDollars.trim();
    const cents = trimmedAmount === "" ? null : dollarsToCentsStrict(trimmedAmount);
    if (cents !== null && Number.isNaN(cents)) {
      setSaveError("Enter a valid amount (e.g. 1250 or 1,250.50).");
      return;
    }
    const trimmedDiscount = form.discountDollars.trim();
    const discountCents = trimmedDiscount === "" ? null : dollarsToCentsStrict(trimmedDiscount);
    if (discountCents !== null && Number.isNaN(discountCents)) {
      setSaveError("Enter a valid discount amount.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          amountDollars: form.amountDollars,
          discountDollars: form.discountDollars,
          scheduledDate: form.scheduledDate,
          scheduledTime: form.scheduledTime,
          address: form.address,
          notes: form.notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || "Couldn't save the job. Please try again.");
        return;
      }
      setJob((j) => ({
        ...j,
        title: form.title.trim() || j.title,
        amountCents: cents,
        discountCents,
        scheduledDate: form.scheduledDate || null,
        scheduledTime: form.scheduledTime || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      }));
      setEditing(false);
      router.refresh();
    } catch {
      setSaveError("Couldn't save the job. Please try again.");
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
              {job.discountCents ? (
                <Field label="Discount" value={`−${money(job.discountCents)}`} />
              ) : null}
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
            <div className="jobFormRow">
              <EditRow label="Amount ($)">
                <input
                  className="adminInput"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amountDollars}
                  onChange={(e) => setForm((f) => ({ ...f, amountDollars: e.target.value }))}
                />
              </EditRow>
              <EditRow label="Discount ($)">
                <input
                  className="adminInput"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.discountDollars}
                  onChange={(e) => setForm((f) => ({ ...f, discountDollars: e.target.value }))}
                />
              </EditRow>
            </div>
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
                    discountDollars: job.discountCents != null ? (job.discountCents / 100).toString() : "",
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
            {saveError && (
              <p className="field-error" role="alert" style={{ marginTop: 10 }}>
                {saveError}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="custPanel">
        <div className="custPanelHead">
          <h2 className="custPanelTitle">
            Materials <span className="custPanelCount">{materials.length}</span>
          </h2>
          <button className="adminTab" onClick={openAddMaterial}>
            + Add material
          </button>
        </div>

        {(companyCents > 0 || clientCents > 0) && (
          <div className="matTotals" style={{ marginBottom: 12 }}>
            <span className="matTotalCo">Company {money(companyCents)}</span>
            <span className="matTotalCl">Client {money(clientCents)}</span>
          </div>
        )}

        {materials.length === 0 ? (
          <p className="custEmptyLine">No materials logged yet.</p>
        ) : (
          <ul className="matList">
            {materials.map((m) => (
              <li key={m.id} className="matItem">
                <span className="matName">{m.name}</span>
                {m.store && <span className="matStore">{m.store}</span>}
                <span className="matItemPrice">{money(m.priceCents)}</span>
                <span className={`matTag mat-${m.purchaser}`}>
                  {m.purchaser === "company" ? "Company" : "Client"}
                </span>
                <button type="button" className="matEditBtn" onClick={() => openEditMaterial(m)}>
                  Edit
                </button>
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

        {matModalOpen && (
          <div
            className="jdModalOverlay"
            onClick={() => !savingMat && setMatModalOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="jdModalCard" onClick={(e) => e.stopPropagation()}>
              <div className="jdModalHead">
                <h3 className="jdModalTitle">
                  {matEditingId ? "Edit material" : "Add material"}
                </h3>
                <button
                  type="button"
                  className="jdModalClose"
                  onClick={() => setMatModalOpen(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <form className="jdModalForm" onSubmit={saveMaterial}>
                <label className="jdField">
                  <span className="jdFieldLabel">Material</span>
                  <MaterialAutocomplete
                    value={matName}
                    onChangeName={setMatName}
                    onPick={(s) => {
                      setMatName(s.name);
                      setMatPrice((s.priceCents / 100).toString());
                    }}
                    placeholder="e.g. Drywall screws"
                  />
                </label>
                <div className="jobFormRow">
                  <label className="jdField">
                    <span className="jdFieldLabel">Price ($)</span>
                    <input
                      className="adminInput"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={matPrice}
                      onChange={(e) => setMatPrice(e.target.value)}
                    />
                  </label>
                  <label className="jdField">
                    <span className="jdFieldLabel">Purchased by</span>
                    <select
                      className="adminInput"
                      value={matPurchaser}
                      onChange={(e) => setMatPurchaser(e.target.value as MaterialPurchaser)}
                    >
                      <option value="company">Company</option>
                      <option value="client">Client</option>
                    </select>
                  </label>
                </div>
                <label className="jdField">
                  <span className="jdFieldLabel">Purchased at</span>
                  <select
                    className="adminInput"
                    value={matStore}
                    onChange={(e) => setMatStore(e.target.value)}
                  >
                    <option value="">— Store (optional) —</option>
                    {MATERIAL_STORES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value={STORE_OTHER}>Other…</option>
                  </select>
                </label>
                {matStore === STORE_OTHER && (
                  <label className="jdField">
                    <span className="jdFieldLabel">Where purchased</span>
                    <input
                      className="adminInput"
                      placeholder="Store or supplier name"
                      value={matStoreCustom}
                      onChange={(e) => setMatStoreCustom(e.target.value)}
                      autoFocus
                    />
                  </label>
                )}
                {matError && (
                  <p className="field-error" role="alert">
                    {matError}
                  </p>
                )}
                <div className="jdModalActions">
                  <button
                    type="submit"
                    className="adminLoginBtn"
                    style={{ marginTop: 0, width: "auto", padding: "12px 26px" }}
                    disabled={
                      savingMat ||
                      !matName.trim() ||
                      (matStore === STORE_OTHER && !matStoreCustom.trim())
                    }
                  >
                    {savingMat ? "Saving…" : matEditingId ? "Save changes" : "Add material"}
                  </button>
                  <button
                    type="button"
                    className="adminTab"
                    onClick={() => setMatModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>

      <section className="custPanel">
        <div className="custPanelHead">
          <h2 className="custPanelTitle">
            Invoices <span className="custPanelCount">{quotes.length}</span>
          </h2>
        </div>

        {quotes.length === 0 ? (
          <p className="custEmptyLine">
            No invoice yet — create one from this job&rsquo;s amount, materials, and
            discount below.
          </p>
        ) : (
          <div className="jobQuoteList">
            {quotes.map((q) => (
              <Link
                key={q.id}
                href={`/admin/customers/${q.customerId}`}
                className="jobQuoteRow"
              >
                <span className="jobQuoteNum">Q-{q.number}</span>
                <span className="jobQuoteTitle">{q.title}</span>
                <span className={`jobQuoteStatus jqs-${q.status}`}>{q.status}</span>
                <span className="jobQuoteTotal">{money(q.totalCents)}</span>
                <span className="jobQuoteGo" aria-hidden>
                  →
                </span>
              </Link>
            ))}
          </div>
        )}

        {invoiceError && (
          <p className="field-error" role="alert" style={{ marginTop: 10 }}>
            {invoiceError}
          </p>
        )}
        <button
          className="adminLoginBtn jobInvoiceBtn"
          onClick={createInvoice}
          disabled={creatingInvoice}
        >
          {creatingInvoice ? "Creating…" : "Create Invoice"}
        </button>
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
