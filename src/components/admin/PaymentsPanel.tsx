"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminPayment } from "@/lib/payments";
import type { PaymentMethod, PaymentStatus } from "@/lib/db/schema";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  card_stripe: "Card",
  cash: "Cash",
  check: "Check",
  other: "Other",
};
const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  succeeded: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

function money(cents: number): string {
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

export default function PaymentsPanel({
  customerId,
  payments,
}: {
  customerId: string;
  payments: AdminPayment[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
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
        body: JSON.stringify({ customerId, amountDollars: amount, method, reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not record payment.");
      setAmount("");
      setReference("");
      setAdding(false);
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not record payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="custPanel">
      <div className="custPanelHead">
        <h2 className="custPanelTitle">
          Payments <span className="custPanelCount">{payments.length}</span>
        </h2>
        <button className="adminTab" onClick={() => setAdding((a) => !a)}>
          {adding ? "Close" : "+ Record payment"}
        </button>
      </div>

      {adding && (
        <form className="payForm" onSubmit={submit}>
          <input
            className="adminInput"
            inputMode="decimal"
            placeholder="Amount $"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="jobStatusSelect"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
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
      )}

      {payments.length === 0 ? (
        <p className="custEmptyLine">No payments recorded yet.</p>
      ) : (
        <div className="payRows">
          {payments.map((p) => (
            <div key={p.id} className="payRow">
              <span className="payRowAmt">{money(p.amountCents)}</span>
              <span className="payRowMethod">{METHOD_LABEL[p.method]}</span>
              <span className={`payStatus ps-${p.status}`}>{STATUS_LABEL[p.status]}</span>
              <span className="payRowRef">{p.reference || ""}</span>
              <span className="payRowWhen">{fmtDate(p.paidAt || p.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
