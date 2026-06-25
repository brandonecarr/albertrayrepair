/**
 * Notification layer — emails Albert (Resend) and texts him (Twilio)
 * when a new booking or contact request comes in.
 *
 * GRACEFUL FALLBACK: until the Resend / Twilio accounts exist and the
 * env vars are set, these functions simply log the lead to the server
 * console and return success. Nothing throws, so the website works
 * end-to-end today. Add the env vars (see .env.example) to switch on
 * real notifications — no code changes needed.
 */

import type { BookingInput, ContactInput } from "./validation";
import { site } from "./site-config";
import { getNotification, renderTemplate } from "./notifications";

const env = process.env;

const hasResend = Boolean(env.RESEND_API_KEY && env.NOTIFY_EMAIL);
// Sending TO a customer only needs the API key (not Albert's NOTIFY_EMAIL).
const hasResendKey = Boolean(env.RESEND_API_KEY);
const hasTwilio = Boolean(
  env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_FROM &&
    env.NOTIFY_PHONE
);

async function sendEmail(subject: string, lines: string[]) {
  if (!hasResend) {
    // Don't log the body — it contains customer PII (name/phone/email/address)
    // that would otherwise sit in plaintext server logs. Subject only.
    void lines;
    console.info(`[notify] EMAIL not sent (Resend not configured) — "${subject}"`);
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.RESEND_FROM || "Albert Ray's Repairs & Restoration <onboarding@resend.dev>",
      to: env.NOTIFY_EMAIL!,
      subject,
      text: lines.join("\n"),
      replyTo: env.NOTIFY_REPLY_TO || undefined,
    });
  } catch (err) {
    console.error("[notify] Resend email failed:", err);
  }
}

async function sendSms(body: string) {
  if (!hasTwilio) {
    void body;
    console.info("[notify] SMS not sent (Twilio not configured)");
    return;
  }
  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      from: env.TWILIO_FROM,
      to: env.NOTIFY_PHONE!,
      body,
    });
  } catch (err) {
    console.error("[notify] Twilio SMS failed:", err);
  }
}

/** Send an email to an arbitrary recipient (e.g. the customer). */
async function sendEmailTo(to: string, subject: string, body: string) {
  if (!hasResendKey) {
    void body;
    console.info(`[notify] customer EMAIL not sent (Resend not configured) — "${subject}"`);
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.RESEND_FROM || "Albert Ray's Repairs & Restoration <onboarding@resend.dev>",
      to,
      subject,
      text: body,
      replyTo: env.NOTIFY_REPLY_TO || env.NOTIFY_EMAIL || undefined,
    });
  } catch (err) {
    console.error("[notify] Resend customer email failed:", err);
  }
}

/**
 * Confirmation email to the customer after they request a booking. Uses the
 * admin-managed "booking_confirmation" template; no-ops if it's disabled or
 * the customer didn't give an email.
 */
export async function sendBookingConfirmation(b: BookingInput) {
  if (!b.email) return;
  const n = await getNotification("booking_confirmation");
  if (!n || !n.enabled) return;
  const vars: Record<string, string> = {
    name: b.name.split(" ")[0] || b.name,
    service: b.service || "your project",
    date: b.dateLabel || b.date,
    time: b.time || "",
    address: b.address,
    phone: site.phoneDisplay,
  };
  const subject = renderTemplate(n.subject || "Your appointment request", vars);
  const body = renderTemplate(n.body, vars);
  await sendEmailTo(b.email, subject, body);
}

export async function notifyNewBooking(b: BookingInput) {
  const when = `${b.dateLabel || b.date} at ${b.time}`;
  const emailLines = [
    "NEW BOOKING REQUEST",
    "====================",
    `Service:  ${b.service}`,
    `When:     ${when}`,
    `Name:     ${b.name}`,
    `Phone:    ${b.phone}`,
    `Email:    ${b.email || "—"}`,
    `Address:  ${b.address}`,
    "",
    "Notes:",
    b.notes || "—",
  ];
  const sms = `New booking: ${b.name} (${b.phone}) — ${b.service}, ${when}. Address: ${b.address}`;

  await Promise.all([
    sendEmail(`New booking — ${b.name}, ${when}`, emailLines),
    sendSms(sms),
  ]);
}

export async function notifyNewContact(c: ContactInput) {
  const emailLines = [
    "NEW CONTACT MESSAGE",
    "===================",
    `Name:     ${c.name}`,
    `Contact:  ${c.contact}`,
    "",
    "Message:",
    c.message,
  ];
  const sms = `New message from ${c.name} (${c.contact}): ${c.message.slice(0, 120)}`;

  await Promise.all([
    sendEmail(`New message — ${c.name}`, emailLines),
    sendSms(sms),
  ]);
}
