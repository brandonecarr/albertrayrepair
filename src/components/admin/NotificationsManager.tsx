"use client";

import { useState } from "react";
import type { AdminNotification } from "@/lib/notifications";

export default function NotificationsManager({
  items,
}: {
  items: AdminNotification[];
}) {
  return (
    <div className="notifList">
      {items.map((n) => (
        <NotificationCard key={n.key} initial={n} />
      ))}
    </div>
  );
}

function NotificationCard({ initial }: { initial: AdminNotification }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [body, setBody] = useState(initial.body);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const dirty = subject !== (initial.subject ?? "") || body !== initial.body;

  async function patch(payload: Record<string, unknown>) {
    const res = await fetch(`/api/admin/notifications/${initial.key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Could not save.");
    }
  }

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaved(false);
    setError("");
    try {
      await patch({ enabled: next });
    } catch (err) {
      setEnabled(!next); // rollback
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await patch({
        subject: initial.channel === "email" ? subject : null,
        body,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="notifCard">
      <div className="notifHead">
        <div className="notifHeadText">
          <div className="notifTitleRow">
            <h2 className="notifTitle">{initial.label}</h2>
            <span className="notifChannel">{initial.channel}</span>
          </div>
          <p className="notifDesc">{initial.description}</p>
        </div>
        <label className="notifToggle">
          <input type="checkbox" checked={enabled} onChange={toggle} />
          <span>{enabled ? "On" : "Off"}</span>
        </label>
      </div>

      <div className={`notifBody ${enabled ? "" : "notifDimmed"}`}>
        {initial.channel === "email" && (
          <label className="notifField">
            <span className="adminFieldLabel">Subject</span>
            <input
              className="adminInput"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setSaved(false);
              }}
            />
          </label>
        )}

        <label className="notifField">
          <span className="adminFieldLabel">Message</span>
          <textarea
            className="adminInput notifTextarea"
            rows={11}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSaved(false);
            }}
          />
        </label>

        <div className="notifPlaceholders">
          <span className="notifPhLabel">Insert:</span>
          {initial.placeholders.map((p) => (
            <button
              type="button"
              key={p}
              className="notifPhChip"
              onClick={() => {
                setBody((b) => `${b}{${p}}`);
                setSaved(false);
              }}
              title={`Insert {${p}}`}
            >
              {`{${p}}`}
            </button>
          ))}
        </div>

        <div className="notifActions">
          <button
            className="adminLoginBtn"
            style={{ marginTop: 0, width: "auto", padding: "12px 26px" }}
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="availSaved">✓ Saved</span>}
          {error && <span className="adminLoginError" style={{ margin: 0 }}>{error}</span>}
        </div>
      </div>
    </section>
  );
}
