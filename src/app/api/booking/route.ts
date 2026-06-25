import { NextResponse } from "next/server";
import { bookingSchema } from "@/lib/validation";
import { notifyNewBooking, sendBookingConfirmation } from "@/lib/notify";
import { saveBookingLead } from "@/lib/leads";
import { createBookingRequest, linkBookingLead } from "@/lib/scheduling";
import { rateLimit, clientIp, bodyTooLarge } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (bodyTooLarge(req)) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  if (!rateLimit(`booking:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { error: "Please check the booking details and try again.", fieldErrors },
      { status: 400 }
    );
  }

  // Honeypot: a real user never fills `company`. If present, accept the
  // request (return ok so the bot sees success) but silently drop it.
  if (parsed.data.company) {
    return NextResponse.json({ ok: true });
  }

  const data = parsed.data;

  // Reserve the slot first. The DB's partial unique index is the real guard
  // against double-booking — if the slot was just taken, fail before we log
  // a lead or notify, and tell the customer to pick another time.
  const reservation = await createBookingRequest({
    date: data.date,
    time: data.time,
    name: data.name,
    phone: data.phone,
    email: data.email || null,
    service: data.service,
    address: data.address,
    notes: data.notes || null,
  });

  if (!reservation.ok && reservation.reason === "slot_taken") {
    return NextResponse.json(
      {
        error:
          "That time was just booked. Please pick another slot — the calendar has been refreshed.",
        slotTaken: true,
      },
      { status: 409 }
    );
  }

  // Persist to the lead inbox (audit), then link the reserved booking to that
  // lead so the admin can trace one to the other. Then notify Albert and send
  // the customer their confirmation. All run with or without a database.
  const leadId = await saveBookingLead(data);
  if (reservation.ok && leadId) {
    await linkBookingLead(reservation.id, leadId);
  }
  await Promise.all([notifyNewBooking(data), sendBookingConfirmation(data)]);
  return NextResponse.json({ ok: true });
}
