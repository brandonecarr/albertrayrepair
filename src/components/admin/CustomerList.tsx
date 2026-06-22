"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminCustomer } from "@/lib/customers";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function CustomerList({
  customers,
}: {
  customers: AdminCustomer[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Enter a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add customer.");
      // Jump straight to the new (or matched) record.
      router.push(`/admin/customers/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add customer.");
      setSaving(false);
    }
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.email, c.address]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle))
    );
  }, [customers, q]);

  return (
    <>
      <div className="custSearch">
        <input
          type="search"
          className="adminInput"
          placeholder="Search by name, phone, email, address…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="custCount">
          {visible.length} of {customers.length}
        </span>
        <button className="adminTab" onClick={() => setAdding((a) => !a)}>
          {adding ? "Close" : "+ New customer"}
        </button>
      </div>

      {adding && (
        <form className="jobForm" onSubmit={create}>
          <input
            className="adminInput"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="jobFormRow">
            <input
              className="adminInput"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <input
              className="adminInput"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className="adminInput"
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <textarea
            className="adminInput"
            rows={2}
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          {error && <p className="adminLoginError" style={{ margin: 0 }}>{error}</p>}
          <button
            className="adminLoginBtn"
            style={{ marginTop: 0, width: "auto", padding: "12px 26px" }}
            disabled={saving}
          >
            {saving ? "Saving…" : "Add customer"}
          </button>
        </form>
      )}

      {customers.length === 0 ? (
        <div className="adminEmpty">
          <div>
            <p className="adminEmptyTitle">No customers yet</p>
            <p>
              The roster fills in automatically as booking and contact leads
              arrive — or add one above.
            </p>
          </div>
        </div>
      ) : (
      <div className="custGrid">
        {visible.map((c) => (
          <Link key={c.id} href={`/admin/customers/${c.id}`} className="custCard">
            <span className="custAvatar">{initials(c.name)}</span>
            <span className="custCardBody">
              <span className="custCardName">{c.name}</span>
              <span className="custCardMeta">
                {c.phone || c.email || "No contact on file"}
              </span>
              {c.address && <span className="custCardAddr">{c.address}</span>}
            </span>
            <span className="custCardArrow" aria-hidden>
              →
            </span>
          </Link>
        ))}
        {visible.length === 0 && (
          <div className="adminEmpty" style={{ minHeight: 140 }}>
            <p>No customers match “{q}”.</p>
          </div>
        )}
      </div>
      )}
    </>
  );
}
