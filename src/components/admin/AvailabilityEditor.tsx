"use client";

import { useState } from "react";
import type { DayAvailability } from "@/lib/scheduling";
import { WEEKDAY_NAMES } from "@/lib/scheduling";

export default function AvailabilityEditor({
  initial,
}: {
  initial: DayAvailability[];
}) {
  const [days, setDays] = useState<DayAvailability[]>(
    initial.map((d) => ({ ...d, slots: [...d.slots] }))
  );
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function dirty() {
    setSaved(false);
  }

  function toggleDay(weekday: number) {
    setDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, enabled: !d.enabled } : d))
    );
    dirty();
  }

  function removeSlot(weekday: number, idx: number) {
    setDays((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? { ...d, slots: d.slots.filter((_, i) => i !== idx) }
          : d
      )
    );
    dirty();
  }

  function addSlot(weekday: number) {
    const value = (drafts[weekday] ?? "").trim();
    if (!value) return;
    setDays((prev) =>
      prev.map((d) =>
        d.weekday === weekday && !d.slots.includes(value)
          ? { ...d, slots: [...d.slots, value] }
          : d
      )
    );
    setDrafts((prev) => ({ ...prev, [weekday]: "" }));
    dirty();
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save.");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="availWrap">
      <div className="availDays">
        {days.map((d) => (
          <div key={d.weekday} className={`availDay ${d.enabled ? "" : "availDayOff"}`}>
            <div className="availDayHead">
              <span className="availDayName">{WEEKDAY_NAMES[d.weekday]}</span>
              <label className="availToggle">
                <input
                  type="checkbox"
                  checked={d.enabled}
                  onChange={() => toggleDay(d.weekday)}
                />
                <span>{d.enabled ? "Open" : "Closed"}</span>
              </label>
            </div>

            {d.enabled && (
              <>
                <div className="availSlots">
                  {d.slots.length === 0 && (
                    <span className="availNoSlots">No times yet</span>
                  )}
                  {d.slots.map((s, i) => (
                    <span key={`${s}-${i}`} className="availChip">
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSlot(d.weekday, i)}
                        aria-label={`Remove ${s}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <form
                  className="availAdd"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addSlot(d.weekday);
                  }}
                >
                  <input
                    type="text"
                    className="adminInput"
                    placeholder="Add time, e.g. 9:00 AM"
                    value={drafts[d.weekday] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [d.weekday]: e.target.value }))
                    }
                  />
                  <button type="submit" className="availAddBtn">
                    Add
                  </button>
                </form>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="availSave">
        <button className="adminLoginBtn" onClick={save} disabled={saving} style={{ marginTop: 0, width: "auto", padding: "14px 30px" }}>
          {saving ? "Saving…" : "Save availability"}
        </button>
        {saved && <span className="availSaved">✓ Saved</span>}
        {error && <span className="adminLoginError" style={{ margin: 0 }}>{error}</span>}
      </div>
    </div>
  );
}
