"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminCustomer } from "@/lib/customers";
import type { Cursor } from "@/lib/pagination";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

type CustomerLite = { id: string; name: string; phone: string | null; email: string | null };
type CustomerRow = CustomerLite & { address?: string | null };

export default function CustomerList({
  customers: initial,
  initialCursor = null,
}: {
  customers: AdminCustomer[];
  initialCursor?: Cursor | null;
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState<AdminCustomer[]>(initial);
  const [cursor, setCursor] = useState<Cursor | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerLite[] | null>(null);
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

  // Search hits the server (trigram-indexed) so it scales past the loaded page
  // instead of filtering only what's already in memory.
  const searching = q.trim().length > 0;
  useEffect(() => {
    const needle = q.trim();
    // No synchronous reset here — when `searching` is false the grid ignores
    // searchResults entirely, so stale results never render.
    if (!needle) return;
    let active = true;
    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: needle, limit: "25" });
        const res = await fetch(`/api/admin/customers/search?${params}`, { signal: ac.signal });
        const data = await res.json().catch(() => ({}));
        if (active) setSearchResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        /* aborted or failed */
      }
    }, 200);
    return () => {
      active = false;
      ac.abort();
      clearTimeout(t);
    };
  }, [q]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ beforeAt: cursor.createdAt, beforeId: cursor.id });
      const res = await fetch(`/api/admin/customers/list?${params}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.items)) {
        setCustomers((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  // What the grid renders: server search results when searching, else the
  // loaded (paginated) roster.
  const visible: CustomerRow[] = searching
    ? searchResults ?? []
    : customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
      }));

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
          {searching
            ? `${visible.length} match${visible.length === 1 ? "" : "es"}`
            : `${customers.length}${cursor ? "+" : ""} loaded`}
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
        {!searching && cursor && (
          <button
            className="loadMoreBtn"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more customers"}
          </button>
        )}
      </div>
      )}
    </>
  );
}
