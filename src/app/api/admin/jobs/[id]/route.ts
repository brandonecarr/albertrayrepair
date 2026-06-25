import { NextResponse } from "next/server";
import { setJobStatus, updateJob } from "@/lib/jobs";
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
 * Update a single job. Protected by middleware (admin session required).
 * Body may carry a status transition and/or editable fields:
 *   { status?, title?, amountDollars?, scheduledDate?, scheduledTime?,
 *     address?, notes? }
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Status transition.
  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !VALID_STATUSES.includes(body.status as JobStatus)
    ) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    const ok = await setJobStatus(id, body.status as JobStatus);
    if (!ok) {
      return NextResponse.json(
        { error: "Could not update job. Is the database configured?" },
        { status: 503 }
      );
    }
  }

  // Editable fields.
  const fieldKeys = [
    "title",
    "amountDollars",
    "scheduledDate",
    "scheduledTime",
    "address",
    "notes",
  ];
  const hasFields = fieldKeys.some((k) => body[k] !== undefined);
  if (hasFields) {
    const str = (v: unknown): string | null | undefined =>
      v === undefined ? undefined : typeof v === "string" && v.trim() ? v.trim() : null;

    let amountCents: number | null | undefined;
    if (body.amountDollars !== undefined) {
      if (body.amountDollars === null || body.amountDollars === "") {
        amountCents = null;
      } else {
        const cents = dollarsToCentsStrict(body.amountDollars);
        if (Number.isNaN(cents)) {
          return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
        }
        amountCents = cents;
      }
    }

    if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) {
      return NextResponse.json({ error: "A job title is required." }, { status: 400 });
    }

    const ok = await updateJob(id, {
      title: typeof body.title === "string" ? body.title.trim() : undefined,
      amountCents,
      scheduledDate: str(body.scheduledDate),
      scheduledTime: str(body.scheduledTime),
      address: str(body.address),
      notes: str(body.notes),
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Could not update job. Is the database configured?" },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
