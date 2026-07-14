"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminQuote } from "@/lib/quotes";
import type { QuoteStatus } from "@/lib/db/schema";

// Invoice-facing labels (the underlying records reuse the quote store).
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

export default function InvoiceDetail({
  invoice,
  customerName,
  jobTitle,
}: {
  invoice: AdminQuote;
  customerName: string | null;
  jobTitle: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const s = invoice.status;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/quotes/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      if (res.ok) {
        router.push(invoice.jobId ? `/admin/jobs/${invoice.jobId}` : `/admin/customers/${invoice.customerId}`);
      } else {
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
                  <Link
                    href={`/admin/customers/${invoice.customerId}`}
                    className="adminCustLink"
                    style={{ marginTop: 0 }}
                  >
                    {customerName}
                  </Link>
                </>
              ) : (
                "Invoice"
              )}
              {invoice.jobId && (
                <>
                  {" · "}
                  <Link
                    href={`/admin/jobs/${invoice.jobId}`}
                    className="adminCustLink"
                    style={{ marginTop: 0 }}
                  >
                    {jobTitle || "View job"}
                  </Link>
                </>
              )}
            </p>
          </div>
          <span className={`quoteStatus qs-${s}`}>{STATUS_LABEL[s]}</span>
        </div>

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
            <span className="invLineDesc">Total</span>
            <span className="invLineAmt">{money(invoice.totalCents)}</span>
          </div>
        </div>

        {invoice.notes && <p className="quoteNotes">{invoice.notes}</p>}

        <div className="quoteActions" style={{ marginTop: 16 }}>
          {s === "draft" && (
            <button className="quoteAct" disabled={busy} onClick={() => patch({ status: "sent" })}>
              Mark sent
            </button>
          )}
          {s !== "accepted" && (
            <button className="quoteAct quoteActGo" disabled={busy} onClick={() => patch({ status: "accepted" })}>
              Mark paid
            </button>
          )}
          {s === "accepted" && (
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
      </section>
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
      <button className="adminLoginBtn" style={{ marginTop: 0, width: "auto", padding: "10px 20px" }} disabled={busy}>
        {busy ? "Saving…" : "Record"}
      </button>
      {err && <p className="adminLoginError" style={{ margin: "6px 0 0", flexBasis: "100%" }}>{err}</p>}
    </form>
  );
}
