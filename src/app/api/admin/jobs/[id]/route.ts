import { NextResponse } from "next/server";
import { setJobStatus, updateJob } from "@/lib/jobs";
import { dollarsToCentsStrict, parseMoney } from "@/lib/money";
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
    "discountType",
    "discountValue",
    "scheduledDate",
    "scheduledTime",
    "address",
    "notes",
  ];
  const hasFields = fieldKeys.some((k) => body[k] !== undefined);
  if (hasFields) {
    const str = (v: unknown): string | null | undefined =>
      v === undefined ? undefined : typeof v === "string" && v.trim() ? v.trim() : null;

    // Parse a dollars field to cents | null | undefined (undefined = unchanged).
    const dollars = (v: unknown): number | null | undefined | "invalid" => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const cents = dollarsToCentsStrict(v);
      return Number.isNaN(cents) ? "invalid" : cents;
    };

    const amountCents = dollars(body.amountDollars);
    if (amountCents === "invalid") {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }

    // Discount: a type ('fixed' | 'percent') + a value. Empty value clears it.
    let discount:
      | { discountType?: string | null; discountCents?: number | null; discountBps?: number | null }
      | "invalid" = {};
    if (body.discountType !== undefined || body.discountValue !== undefined) {
      const type = body.discountType;
      const raw = body.discountValue;
      const valStr =
        typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
      if (!type || type === "none" || valStr === "") {
        discount = { discountType: null, discountCents: null, discountBps: null };
      } else if (type === "fixed") {
        const cents = dollarsToCentsStrict(valStr);
        discount = Number.isNaN(cents)
          ? "invalid"
          : { discountType: "fixed", discountCents: cents, discountBps: null };
      } else if (type === "percent") {
        const pct = parseMoney(valStr);
        discount =
          !Number.isFinite(pct) || pct < 0 || pct > 100
            ? "invalid"
            : { discountType: "percent", discountBps: Math.round(pct * 100), discountCents: null };
      } else {
        discount = "invalid";
      }
    }
    if (discount === "invalid") {
      return NextResponse.json(
        { error: "Enter a valid discount (a dollar amount, or a percent from 0–100)." },
        { status: 400 }
      );
    }

    if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) {
      return NextResponse.json({ error: "A job title is required." }, { status: 400 });
    }

    const ok = await updateJob(id, {
      title: typeof body.title === "string" ? body.title.trim() : undefined,
      amountCents,
      ...discount,
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
