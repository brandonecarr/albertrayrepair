import { NextResponse } from "next/server";
import { recordManualPayment } from "@/lib/payments";
import type { PaymentMethod } from "@/lib/db/schema";

export const runtime = "nodejs";

const MANUAL_METHODS: PaymentMethod[] = ["cash", "check", "other"];

/**
 * Record a payment collected outside Stripe (cash / check / other).
 * Protected by middleware. Body:
 *   { customerId, amountDollars, method, quoteId?, reference? }
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
  const amount = Number(body.amountDollars);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a payment amount." }, { status: 400 });
  }
  if (
    typeof body.method !== "string" ||
    !MANUAL_METHODS.includes(body.method as PaymentMethod)
  ) {
    return NextResponse.json({ error: "Pick cash, check, or other." }, { status: 400 });
  }

  const id = await recordManualPayment({
    customerId: body.customerId,
    quoteId:
      typeof body.quoteId === "string" && body.quoteId ? body.quoteId : null,
    amountCents: Math.round(amount * 100),
    method: body.method as "cash" | "check" | "other",
    reference:
      typeof body.reference === "string" && body.reference.trim()
        ? body.reference.trim()
        : null,
  });

  if (!id) {
    return NextResponse.json(
      { error: "Could not record payment. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, id });
}
