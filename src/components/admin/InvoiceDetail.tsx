"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminQuote } from "@/lib/quotes";
import type { QuoteStatus } from "@/lib/db/schema";

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Paid",
  declined: "Void",
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

type Props = {
  invoice: AdminQuote;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  jobTitle: string | null;
};

export default function InvoiceDetail(props: Props) {
  const { invoice, customerName, jobTitle } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [sendVariant, setSendVariant] = useState<null | "normal" | "paid">(null);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const s = invoice.status;
  const paid = s === "accepted";
  const pdfHref = `/api/admin/invoices/${invoice.id}/pdf${paid ? "?variant=paid" : ""}`;

  async function patch(bodyObj: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/quotes/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      if (res.ok) router.refresh();
      else setErr("Couldn't update the invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this invoice? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/quotes/${invoice.id}`, { method: "DELETE" });
      if (res.ok)
        router.push(invoice.jobId ? `/admin/jobs/${invoice.jobId}` : `/admin/customers/${invoice.customerId}`);
      else {
        setErr("Couldn't delete the invoice.");
        setBusy(false);
      }
    } catch {
      setErr("Couldn't delete the invoice.");
      setBusy(false);
    }
  }

  async function makeLink() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/quotes/${invoice.id}/checkout`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLink(data.url);
        navigator.clipboard?.writeText(data.url).catch(() => {});
      } else {
        setErr(data.error || "Could not create a payment link.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="custDetail">
      <section className="custPanel">
        <div className="custPanelHead">
          <div className="custIdentity">
            <h1 className="adminTitle" style={{ marginBottom: 4 }}>
              Invoice <span className="accent">#{invoice.number}</span>
            </h1>
            <p className="adminSub">
              {customerName ? (
                <>
                  For{" "}
                  <Link href={`/admin/customers/${invoice.customerId}`} className="adminCustLink" style={{ marginTop: 0 }}>
                    {customerName}
                  </Link>
                </>
              ) : (
                "Invoice"
              )}
              {invoice.jobId && (
                <>
                  {" · "}
                  <Link href={`/admin/jobs/${invoice.jobId}`} className="adminCustLink" style={{ marginTop: 0 }}>
                    {jobTitle || "View job"}
                  </Link>
                </>
              )}
            </p>
          </div>
          <span className={`quoteStatus qs-${s}`}>{STATUS_LABEL[s]}</span>
        </div>

        {editing ? (
          <InvoiceEditor invoice={invoice} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <div className="invLines">
              {invoice.lineItems.map((li) => (
                <div key={li.id} className="invLine">
                  <span className="invLineDesc">{li.description}</span>
                  <span className="invLineAmt">{money(li.lineTotalCents)}</span>
                </div>
              ))}
              {invoice.taxCents ? (
                <div className="invLine">
                  <span className="invLineDesc">Tax</span>
                  <span className="invLineAmt">{money(invoice.taxCents)}</span>
                </div>
              ) : null}
              <div className="invLine invLineTotal">
                <span className="invLineDesc">{paid ? "Balance Due" : "Total"}</span>
                <span className="invLineAmt">{paid ? money(0) : money(invoice.totalCents)}</span>
              </div>
            </div>

            {invoice.notes && <p className="quoteNotes">{invoice.notes}</p>}

            <div className="quoteActions" style={{ marginTop: 16 }}>
              <button className="quoteAct" disabled={busy} onClick={() => setEditing(true)}>
                Edit
              </button>
              <a className="quoteAct" href={pdfHref} target="_blank" rel="noreferrer">
                Download
              </a>
              <button className="quoteAct" disabled={busy} onClick={() => setSendVariant("normal")}>
                Send invoice
              </button>
              {paid && (
                <button className="quoteAct quoteActGo" disabled={busy} onClick={() => setSendVariant("paid")}>
                  Send paid invoice
                </button>
              )}
              {s === "draft" && (
                <button className="quoteAct" disabled={busy} onClick={() => patch({ status: "sent" })}>
                  Mark sent
                </button>
              )}
              {!paid && (
                <button className="quoteAct quoteActGo" disabled={busy} onClick={() => patch({ status: "accepted" })}>
                  Mark paid
                </button>
              )}
              {paid && (
                <button className="quoteAct" disabled={busy} onClick={() => patch({ status: "sent" })}>
                  Reopen
                </button>
              )}
              <button className="quoteAct" disabled={busy} onClick={makeLink}>
                Payment link
              </button>
              <button className="quoteAct" disabled={busy} onClick={() => setPayOpen((p) => !p)}>
                Record payment
              </button>
              <button className="quoteAct quoteActDanger" disabled={busy} onClick={remove}>
                Delete
              </button>
            </div>

            {link && (
              <p className="quoteLinkOut">
                Link copied:{" "}
                <a href={link} target="_blank" rel="noreferrer">
                  {link}
                </a>
              </p>
            )}
            {err && <p className="adminLoginError" style={{ margin: "8px 0 0" }}>{err}</p>}

            {payOpen && (
              <ManualPayForm
                customerId={invoice.customerId}
                quoteId={invoice.id}
                defaultDollars={(invoice.totalCents / 100).toString()}
                onDone={() => setPayOpen(false)}
              />
            )}
          </>
        )}
      </section>

      {sendVariant && (
        <SendPopup
          invoiceId={invoice.id}
          variant={sendVariant}
          email={props.customerEmail}
          phone={props.customerPhone}
          onClose={() => setSendVariant(null)}
        />
      )}
    </div>
  );
}

// ─── Send popup (email / text) ───────────────────────────────────────────────
function SendPopup({
  invoiceId,
  variant,
  email,
  phone,
  onClose,
}: {
  invoiceId: string;
  variant: "normal" | "paid";
  email: string | null;
  phone: string | null;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<"email" | "sms">(email ? "email" : "sms");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, variant: variant === "paid" ? "paid" : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDone(`Sent to ${data.sentTo}.`);
      else setErr(data.error || "Couldn't send the invoice.");
    } catch {
      setErr("Couldn't send the invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="jdModalOverlay" onClick={() => !busy && onClose()} role="dialog" aria-modal="true">
      <div className="jdModalCard" onClick={(e) => e.stopPropagation()}>
        <div className="jdModalHead">
          <h3 className="jdModalTitle">{variant === "paid" ? "Send paid invoice" : "Send invoice"}</h3>
          <button type="button" className="jdModalClose" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {done ? (
          <>
            <p className="custEmptyLine" style={{ margin: 0 }}>
              ✓ {done}
            </p>
            <div className="jdModalActions">
              <button className="adminLoginBtn" style={{ marginTop: 0, width: "auto", padding: "12px 26px" }} onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sendChannels">
              <label className={`sendChannel ${channel === "email" ? "sendChannelOn" : ""} ${!email ? "sendChannelOff" : ""}`}>
                <input type="radio" name="ch" disabled={!email} checked={channel === "email"} onChange={() => setChannel("email")} />
                <span className="sendChannelLabel">Email</span>
                <span className="sendChannelTo">{email || "No email on file"}</span>
              </label>
              <label className={`sendChannel ${channel === "sms" ? "sendChannelOn" : ""} ${!phone ? "sendChannelOff" : ""}`}>
                <input type="radio" name="ch" disabled={!phone} checked={channel === "sms"} onChange={() => setChannel("sms")} />
                <span className="sendChannelLabel">Text</span>
                <span className="sendChannelTo">{phone || "No phone on file"}</span>
              </label>
            </div>
            <p className="adminSub" style={{ marginTop: 4, fontSize: 12 }}>
              {channel === "email"
                ? "Emails the invoice as a PDF attachment."
                : "Texts a link to the invoice PDF."}
            </p>
            {err && <p className="field-error" role="alert">{err}</p>}
            <div className="jdModalActions">
              <button
                className="adminLoginBtn"
                style={{ marginTop: 0, width: "auto", padding: "12px 26px" }}
                onClick={send}
                disabled={busy || (channel === "email" ? !email : !phone)}
              >
                {busy ? "Sending…" : channel === "email" ? "Send email" : "Send text"}
              </button>
              <button type="button" className="adminTab" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Line-item editor ────────────────────────────────────────────────────────
type EditRow = { description: string; quantity: string; unitDollars: string };

function InvoiceEditor({
  invoice,
  onDone,
  onCancel,
}: {
  invoice: AdminQuote;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditRow[]>(
    invoice.lineItems.map((li) => ({
      description: li.description,
      quantity: String(li.quantity),
      unitDollars: (li.unitAmountCents / 100).toString(),
    }))
  );
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const total = rows.reduce((s, r) => {
    const q = Number(r.quantity);
    const u = Number(r.unitDollars);
    return s + (Number.isFinite(q) && Number.isFinite(u) ? Math.round(q * u * 100) : 0);
  }, 0);

  function setRow(i: number, patch: Partial<EditRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    const lineItems = rows
      .filter((r) => r.description.trim())
      .map((r) => ({ description: r.description.trim(), quantity: r.quantity, unitDollars: r.unitDollars }));
    if (lineItems.length === 0) {
      setErr("Add at least one line item.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/quotes/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, lineItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Couldn't save the invoice.");
        return;
      }
      onDone();
      router.refresh();
    } catch {
      setErr("Couldn't save the invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="invEditor">
      <div className="invEditHead">
        <span className="invEditColDesc">Description</span>
        <span className="invEditColQty">Qty</span>
        <span className="invEditColUnit">Unit $</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="invEditRow">
          <input
            className="adminInput"
            placeholder="Description"
            value={r.description}
            onChange={(e) => setRow(i, { description: e.target.value })}
          />
          <input
            className="adminInput invEditQty"
            inputMode="decimal"
            value={r.quantity}
            onChange={(e) => setRow(i, { quantity: e.target.value })}
          />
          <input
            className="adminInput invEditUnit"
            inputMode="decimal"
            placeholder="0.00"
            value={r.unitDollars}
            onChange={(e) => setRow(i, { unitDollars: e.target.value })}
          />
          <button
            type="button"
            className="invEditDel"
            onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
            aria-label="Remove line"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="reportRangeBtn"
        style={{ marginTop: 8 }}
        onClick={() => setRows((rs) => [...rs, { description: "", quantity: "1", unitDollars: "" }])}
      >
        + Add line
      </button>

      <textarea
        className="adminInput"
        rows={2}
        placeholder="Notes (optional)"
        style={{ marginTop: 12 }}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <p className="invEditTotal">Total: {money(total)}</p>
      {err && <p className="field-error" role="alert">{err}</p>}
      <div className="jdModalActions">
        <button className="adminLoginBtn" style={{ marginTop: 0, width: "auto", padding: "12px 26px" }} onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save invoice"}
        </button>
        <button type="button" className="adminTab" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Manual payment ──────────────────────────────────────────────────────────
function ManualPayForm({
  customerId,
  quoteId,
  defaultDollars,
  onDone,
}: {
  customerId: string;
  quoteId: string;
  defaultDollars?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(defaultDollars ?? "");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, quoteId, amountDollars: amount, method, reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not record payment.");
      onDone();
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not record payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="payForm" onSubmit={submit} style={{ marginTop: 12 }}>
      <input className="adminInput" inputMode="decimal" placeholder="Amount $" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className="jobStatusSelect" value={method} onChange={(e) => setMethod(e.target.value)}>
        <option value="cash">Cash</option>
        <option value="check">Check</option>
        <option value="other">Other</option>
      </select>
      <input className="adminInput" placeholder="Reference (check #, note)" value={reference} onChange={(e) => setReference(e.target.value)} />
      <button className="adminLoginBtn" style={{ marginTop: 0, width: "auto", padding: "10px 20px" }} disabled={busy}>
        {busy ? "Saving…" : "Record"}
      </button>
      {err && <p className="adminLoginError" style={{ margin: "6px 0 0", flexBasis: "100%" }}>{err}</p>}
    </form>
  );
}
