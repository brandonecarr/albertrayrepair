import { NextResponse } from "next/server";
import { createQuote } from "@/lib/quotes";
import { parseLineItems, dollarsToCents } from "@/lib/quote-input";

export const runtime = "nodejs";

/**
 * Create a quote with line items. Protected by middleware (admin session).
 * Body: { customerId, title, notes?, taxDollars?, validUntil?,
 *         lineItems: [{ description, quantity, unitDollars }] }
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
    return NextResponse.json({ error: "A quote title is required." }, { status: 400 });
  }
  const lineItems = parseLineItems(body.lineItems);
  if (!lineItems || lineItems.length === 0) {
    return NextResponse.json(
      { error: "Add at least one line item (description, quantity, price)." },
      { status: 400 }
    );
  }
  const taxCents = dollarsToCents(body.taxDollars);
  if (Number.isNaN(taxCents)) {
    return NextResponse.json({ error: "Invalid tax amount." }, { status: 400 });
  }

  const id = await createQuote({
    customerId: body.customerId,
    title: body.title.trim(),
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    taxCents: taxCents ?? null,
    validUntil:
      typeof body.validUntil === "string" && body.validUntil.trim()
        ? body.validUntil.trim()
        : null,
    lineItems,
  });

  if (!id) {
    return NextResponse.json(
      { error: "Could not create quote. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, id });
}
