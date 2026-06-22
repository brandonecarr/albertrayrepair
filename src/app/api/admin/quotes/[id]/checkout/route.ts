import { NextResponse } from "next/server";
import { createCheckoutLink } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Create a hosted Stripe Checkout link for a quote. Protected by middleware.
 * Returns { url } the admin can send to the customer.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const result = await createCheckoutLink(id);

  if (!result.ok) {
    if (result.reason === "stripe_unconfigured") {
      return NextResponse.json(
        { error: "Stripe isn't connected yet. Add STRIPE_SECRET_KEY to enable card payments." },
        { status: 503 }
      );
    }
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    }
    if (result.reason === "empty") {
      return NextResponse.json(
        { error: "This quote has no billable total." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Could not create a payment link." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, url: result.url });
}
