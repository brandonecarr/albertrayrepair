import { NextResponse } from "next/server";
import {
  setQuoteStatus,
  acceptQuote,
  updateQuote,
  deleteQuote,
} from "@/lib/quotes";
import type { QuoteStatus } from "@/lib/db/schema";
import { parseLineItems, dollarsToCents } from "@/lib/quote-input";

export const runtime = "nodejs";

const VALID_STATUSES: QuoteStatus[] = ["draft", "sent", "accepted", "declined"];

/**
 * Update a quote. Protected by middleware (admin session).
 * Body may carry a status transition and/or field/line edits:
 *   { status?, title?, notes?, taxDollars?, validUntil?,
 *     lineItems?: [{ description, quantity, unitDollars }] }
 * status "accepted" runs the accept flow (creates a linked job).
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

  let jobId: string | undefined;

  // Status transition.
  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !VALID_STATUSES.includes(body.status as QuoteStatus)
    ) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    if (body.status === "accepted") {
      const result = await acceptQuote(id);
      if (!result.ok) {
        const status = result.reason === "not_found" ? 404 : 503;
        return NextResponse.json(
          { error: "Could not accept quote. Is the database configured?" },
          { status }
        );
      }
      jobId = result.jobId;
    } else {
      const ok = await setQuoteStatus(id, body.status as QuoteStatus);
      if (!ok) {
        return NextResponse.json(
          { error: "Could not update quote. Is the database configured?" },
          { status: 503 }
        );
      }
    }
  }

  // Field / line-item edits.
  const editKeys = ["title", "notes", "taxDollars", "validUntil", "lineItems"];
  if (editKeys.some((k) => body[k] !== undefined)) {
    if (
      body.title !== undefined &&
      (typeof body.title !== "string" || !body.title.trim())
    ) {
      return NextResponse.json({ error: "A quote title is required." }, { status: 400 });
    }
    const taxCents = dollarsToCents(body.taxDollars);
    if (Number.isNaN(taxCents)) {
      return NextResponse.json({ error: "Invalid tax amount." }, { status: 400 });
    }
    let lineItems;
    if (body.lineItems !== undefined) {
      lineItems = parseLineItems(body.lineItems);
      if (!lineItems || lineItems.length === 0) {
        return NextResponse.json(
          { error: "Add at least one line item." },
          { status: 400 }
        );
      }
    }

    const ok = await updateQuote(id, {
      title: typeof body.title === "string" ? body.title.trim() : undefined,
      notes:
        body.notes === undefined
          ? undefined
          : typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : null,
      taxCents,
      validUntil:
        body.validUntil === undefined
          ? undefined
          : typeof body.validUntil === "string" && body.validUntil.trim()
            ? body.validUntil.trim()
            : null,
      lineItems,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Could not update quote. Is the database configured?" },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({ ok: true, jobId });
}

/** Delete a quote (line items cascade). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ok = await deleteQuote(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not delete quote. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
