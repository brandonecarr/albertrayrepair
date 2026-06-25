"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AdminQuote } from "@/lib/quotes";
import type { QuoteStatus } from "@/lib/db/schema";

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

type EditRow = { description: string; quantity: string; unitDollars: string };
const blankRow = (): EditRow => ({ description: "", quantity: "1", unitDollars: "" });

export default function QuotesPanel({
  customerId,
  quotes,
}: {
  customerId: string;
  quotes: AdminQuote[];
}) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="custPanel">
      <div className="custPanelHead">
        <h2 className="custPanelTitle">
          Quotes <span className="custPanelCount">{quotes.length}</span>
        </h2>
        <button className="adminTab" onClick={() => setCreating((c) => !c)}>
          {creating ? "Close" : "+ New quote"}
        </button>
      </div>

      {creating && (
        <QuoteEditor
          customerId={customerId}
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {quotes.length === 0 ? (
        <p className="custEmptyLine">No quotes yet for this customer.</p>
      ) : (
        <div className="quoteList">
          {quotes.map((q) => (
            <QuoteCard key={q.id} quote={q} />
          ))}
        </div>
      )}
    </section>
  );
}

function QuoteCard({ quote }: { quote: AdminQuote }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [linkErr, setLinkErr] = useState("");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this quote?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function makeLink() {
    setBusy(true);
    setLinkErr("");
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/checkout`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLink(data.url);
        navigator.clipboard?.writeText(data.url).catch(() => {});
      } else {
        setLinkErr(data.error || "Could not create a payment link.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <QuoteEditor
        customerId={quote.customerId}
        quote={quote}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const s = quote.status;
  return (
    <div className="quoteCard">
      <div className="quoteCardTop">
        <span className="quoteNum">Q-{quote.number}</span>
        <span className="quoteCardTitle">{quote.title}</span>
        <span className={`quoteStatus qs-${s}`}>{STATUS_LABEL[s]}</span>
        <span className="quoteTotal">{money(quote.totalCents)}</span>
      </div>

      <div className="quoteLines">
        {quote.lineItems.map((li) => (
          <div key={li.id} className="quoteLine">
            <span className="quoteLineDesc">{li.description}</span>
            <span className="quoteLineQty">
              {li.quantity} × {money(li.unitAmountCents)}
            </span>
            <span className="quoteLineAmt">{money(li.lineTotalCents)}</span>
          </div>
        ))}
        {quote.taxCents ? (
          <div className="quoteLine quoteLineTax">
            <span className="quoteLineDesc">Tax</span>
            <span />
            <span className="quoteLineAmt">{money(quote.taxCents)}</span>
          </div>
        ) : null}
      </div>

      {quote.notes && <p className="quoteNotes">{quote.notes}</p>}

      <div className="quoteActions">
        {s === "draft" && (
          <>
            <button className="quoteAct" disabled={busy} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="quoteAct" disabled={busy} onClick={() => patch({ status: "sent" })}>
              Mark sent
            </button>
          </>
        )}
        {(s === "draft" || s === "sent") && (
          <>
            <button
              className="quoteAct quoteActGo"
              disabled={busy}
              onClick={() => patch({ status: "accepted" })}
            >
              Accept → Job
            </button>
            <button className="quoteAct" disabled={busy} onClick={() => patch({ status: "declined" })}>
              Decline
            </button>
          </>
        )}
        {s !== "declined" && (
          <>
            <button className="quoteAct" disabled={busy} onClick={makeLink}>
              Payment link
            </button>
            <button className="quoteAct" disabled={busy} onClick={() => setPayOpen((p) => !p)}>
              Record payment
            </button>
          </>
        )}
        {quote.jobId && (
          <Link className="quoteAct quoteActLink" href={`/admin/jobs/${quote.jobId}`}>
            View job →
          </Link>
        )}
        <button className="quoteAct quoteActDanger" disabled={busy} onClick={remove}>
          Delete
        </button>
      </div>

      {link && (
        <p className="quoteLinkOut">
          Link copied: <a href={link} target="_blank" rel="noreferrer">{link}</a>
        </p>
      )}
      {linkErr && <p className="adminLoginError" style={{ margin: "6px 0 0" }}>{linkErr}</p>}

      {payOpen && (
        <ManualPayForm
          customerId={quote.customerId}
          quoteId={quote.id}
          defaultDollars={(quote.totalCents / 100).toString()}
          onDone={() => setPayOpen(false)}
        />
      )}
    </div>
  );
}

function ManualPayForm({
  customerId,
  quoteId,
  defaultDollars,
  onDone,
}: {
  customerId: string;
  quoteId?: string;
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
    <form className="payForm" onSubmit={submit}>
      <input
        className="adminInput"
        inputMode="decimal"
        placeholder="Amount $"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <select className="jobStatusSelect" value={method} onChange={(e) => setMethod(e.target.value)}>
        <option value="cash">Cash</option>
        <option value="check">Check</option>
        <option value="other">Other</option>
      </select>
      <input
        className="adminInput"
        placeholder="Reference (check #, note)"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />
      <button className="quoteAct quoteActGo" disabled={busy}>
        {busy ? "Saving…" : "Record"}
      </button>
      {err && <span className="adminLoginError" style={{ margin: 0 }}>{err}</span>}
    </form>
  );
}

function QuoteEditor({
  customerId,
  quote,
  onDone,
  onCancel,
}: {
  customerId: string;
  quote?: AdminQuote;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(quote?.title ?? "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [taxDollars, setTaxDollars] = useState(
    quote?.taxCents != null ? (quote.taxCents / 100).toString() : ""
  );
  const [validUntil, setValidUntil] = useState(quote?.validUntil ?? "");
  const [rows, setRows] = useState<EditRow[]>(
    quote
      ? quote.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity.toString(),
          unitDollars: (li.unitAmountCents / 100).toString(),
        }))
      : [blankRow()]
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const subtotal = rows.reduce((s, r) => {
    const q = Number(r.quantity);
    const u = Number(r.unitDollars);
    if (!Number.isFinite(q) || !Number.isFinite(u)) return s;
    return s + Math.round(q * Math.round(u * 100));
  }, 0);
  const tax = taxDollars ? Math.round(Number(taxDollars) * 100) : 0;
  const total = subtotal + (Number.isFinite(tax) ? tax : 0);

  function setRow(i: number, patch: Partial<EditRow>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setErr("Give the quote a title.");
    const lineItems = rows
      .filter((r) => r.description.trim())
      .map((r) => ({
        description: r.description,
        quantity: Number(r.quantity),
        unitDollars: Number(r.unitDollars),
      }));
    if (lineItems.length === 0) return setErr("Add at least one line item.");

    setBusy(true);
    setErr("");
    try {
      const url = quote ? `/api/admin/quotes/${quote.id}` : "/api/admin/quotes";
      const res = await fetch(url, {
        method: quote ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          title,
          notes,
          taxDollars,
          validUntil,
          lineItems,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save quote.");
      onDone();
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not save quote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="qEditor" onSubmit={submit}>
      <div className="qEditorTop">
        <input
          className="qEditorTitle"
          placeholder="Quote title — e.g. Bathroom faucet + drywall"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="qEditorMeta">
          <span>Valid until</span>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </label>
      </div>

      <div className="qLines">
        {rows.map((r, i) => {
          const q = Number(r.quantity);
          const u = Number(r.unitDollars);
          const lt =
            Number.isFinite(q) && Number.isFinite(u) ? Math.round(q * Math.round(u * 100)) : 0;
          return (
            <div key={i} className="qLine">
              <input
                className="qLineDesc"
                placeholder="Describe the work or material…"
                value={r.description}
                onChange={(e) => setRow(i, { description: e.target.value })}
              />
              <div className="qLineCalc">
                <input
                  className="qNum"
                  inputMode="decimal"
                  aria-label="Quantity"
                  value={r.quantity}
                  onChange={(e) => setRow(i, { quantity: e.target.value })}
                />
                <span className="qOp">×</span>
                <span className="qMoney">
                  <span className="qMoneyPrefix">$</span>
                  <input
                    className="qNum qNumWide"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label="Unit price"
                    value={r.unitDollars}
                    onChange={(e) => setRow(i, { unitDollars: e.target.value })}
                  />
                </span>
                <span className="qLineTotal">{money(lt)}</span>
                <button
                  type="button"
                  className="qLineRemove"
                  aria-label="Remove line"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="qAddLine" onClick={() => setRows((p) => [...p, blankRow()])}>
        + Add line
      </button>

      <div className="qSummary">
        <div className="qSummaryRow">
          <span>Subtotal</span>
          <span className="qSummaryVal">{money(subtotal)}</span>
        </div>
        <div className="qSummaryRow">
          <span>Tax</span>
          <span className="qMoney qMoneySm">
            <span className="qMoneyPrefix">$</span>
            <input
              className="qNum qNumWide"
              inputMode="decimal"
              placeholder="0.00"
              aria-label="Tax"
              value={taxDollars}
              onChange={(e) => setTaxDollars(e.target.value)}
            />
          </span>
        </div>
        <div className="qSummaryRow qSummaryTotal">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>

      <textarea
        className="qNotes"
        rows={2}
        placeholder="Notes or terms (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {err && <p className="adminLoginError" style={{ margin: 0 }}>{err}</p>}
      <div className="qEditorActions">
        <button className="qSave" disabled={busy}>
          {busy ? "Saving…" : quote ? "Save changes" : "Create quote"}
        </button>
        <button type="button" className="qCancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
