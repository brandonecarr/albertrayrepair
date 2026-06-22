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

const env = process.env;

const hasResend = Boolean(env.RESEND_API_KEY && env.NOTIFY_EMAIL);
const hasTwilio = Boolean(
  env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_FROM &&
    env.NOTIFY_PHONE
);

async function sendEmail(subject: string, lines: string[]) {
  if (!hasResend) {
    console.info(`[notify] EMAIL (not configured) — ${subject}\n${lines.join("\n")}`);
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
    console.info(`[notify] SMS (not configured) — ${body}`);
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
