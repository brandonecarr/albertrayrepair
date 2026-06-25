import { NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { dollarsToCentsStrict } from "@/lib/money";
import type { JobStatus } from "@/lib/db/schema";

export const runtime = "nodejs";

const VALID_STATUSES: JobStatus[] = [
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
  "cancelled",
];

/**
 * Create a job for a customer. Protected by middleware (admin session).
 * Body: { customerId, title, status?, amountDollars?, scheduledDate?,
 *         scheduledTime?, address?, notes?, leadId?, bookingId? }
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.customerId !== "string" || !body.customerId) {
    return NextResponse.json({ error: "customerId is required." }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "A job title is required." }, { status: 400 });
  }
  if (
    body.status !== undefined &&
    (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as JobStatus))
  ) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  // amountDollars (free-text) → cents.
  let amountCents: number | null = null;
  if (body.amountDollars !== undefined && body.amountDollars !== null && body.amountDollars !== "") {
    const cents = dollarsToCentsStrict(body.amountDollars);
    if (Number.isNaN(cents)) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }
    amountCents = cents;
  }

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const id = await createJob({
    customerId: body.customerId,
    title: body.title.trim(),
    status: (body.status as JobStatus) ?? "quoted",
    amountCents,
    scheduledDate: str(body.scheduledDate),
    scheduledTime: str(body.scheduledTime),
    address: str(body.address),
    notes: str(body.notes),
    leadId: str(body.leadId),
    bookingId: str(body.bookingId),
  });

  if (!id) {
    return NextResponse.json(
      { error: "Could not create job. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, id });
}
