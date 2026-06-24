/**
 * Outgoing-notification catalog + admin overrides.
 *
 * The catalog (keys, channel, labels, default copy, placeholders) lives here
 * in code. Albert's customizations (enable flag, subject, body) are persisted
 * in the `notifications` table and merged over the defaults. With no DB — or
 * before a notification has ever been edited — the code defaults are used, so
 * everything works out of the box.
 */
import { eq } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { notifications } from "./db/schema";

export type NotificationChannel = "email" | "sms";

export type NotificationDef = {
  key: string;
  channel: NotificationChannel;
  label: string;
  description: string;
  defaultEnabled: boolean;
  defaultSubject?: string; // email only
  defaultBody: string;
  placeholders: string[];
};

/** The catalog. Add new notifications here; the admin UI renders them all. */
export const NOTIFICATION_DEFS: NotificationDef[] = [
  {
    key: "booking_confirmation",
    channel: "email",
    label: "Booking confirmation",
    description:
      "Emailed to the customer right after they request an appointment on the website.",
    defaultEnabled: true,
    defaultSubject:
      "We got your request, {name} — Albert Ray's Repairs & Restoration",
    defaultBody: `Hi {name},

Thanks for reaching out to Albert Ray's Repairs & Restoration! We've received your appointment request and Albert will personally confirm the final time with you shortly.

  • Service: {service}
  • Requested time: {date} at {time}
  • Address: {address}

This is a request, not a final booking yet — we'll be in touch to lock it in. Need it sooner or have a question? Just call us at {phone}.

Talk soon,
Albert Ray's Repairs & Restoration`,
    placeholders: ["name", "service", "date", "time", "address", "phone"],
  },
];

export type AdminNotification = {
  key: string;
  channel: NotificationChannel;
  label: string;
  description: string;
  placeholders: string[];
  enabled: boolean;
  subject: string | null;
  body: string;
};

function merge(
  def: NotificationDef,
  row?: { enabled: boolean; subject: string | null; body: string }
): AdminNotification {
  return {
    key: def.key,
    channel: def.channel,
    label: def.label,
    description: def.description,
    placeholders: def.placeholders,
    enabled: row ? row.enabled : def.defaultEnabled,
    subject: row ? row.subject : def.defaultSubject ?? null,
    body: row ? row.body : def.defaultBody,
  };
}

/** All notifications, defaults merged with any saved overrides. */
export async function listNotifications(): Promise<AdminNotification[]> {
  if (!isDbConfigured || !db) return NOTIFICATION_DEFS.map((d) => merge(d));
  try {
    const rows = await db.select().from(notifications);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return NOTIFICATION_DEFS.map((d) => merge(d, byKey.get(d.key)));
  } catch (err) {
    console.error("[notifications] failed to list:", err);
    return NOTIFICATION_DEFS.map((d) => merge(d));
  }
}

/** One notification by key (merged), or null if the key is unknown. */
export async function getNotification(
  key: string
): Promise<AdminNotification | null> {
  const def = NOTIFICATION_DEFS.find((d) => d.key === key);
  if (!def) return null;
  if (!isDbConfigured || !db) return merge(def);
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.key, key))
      .limit(1);
    return merge(def, rows[0]);
  } catch (err) {
    console.error("[notifications] failed to get:", err);
    return merge(def);
  }
}

/** Persist an override (upsert). Partial — unspecified fields keep their value. */
export async function updateNotification(
  key: string,
  patch: { enabled?: boolean; subject?: string | null; body?: string }
): Promise<boolean> {
  const def = NOTIFICATION_DEFS.find((d) => d.key === key);
  if (!def || !isDbConfigured || !db) return false;
  try {
    const current = (await getNotification(key))!;
    const enabled = patch.enabled ?? current.enabled;
    const subject = patch.subject !== undefined ? patch.subject : current.subject;
    const body = patch.body !== undefined ? patch.body : current.body;
    await db
      .insert(notifications)
      .values({ key, enabled, subject, body, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: notifications.key,
        set: { enabled, subject, body, updatedAt: new Date() },
      });
    return true;
  } catch (err) {
    console.error("[notifications] failed to update:", err);
    return false;
  }
}

/** Replace {placeholder} tokens; unknown tokens become empty strings. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}
