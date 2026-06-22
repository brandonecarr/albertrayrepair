import type Stripe from "stripe";
import { getStripe } from "@/lib/payments";
import { markStripePaymentSucceeded } from "@/lib/payments";

// PUBLIC route — NOT under the proxy matcher (/admin, /api/admin), so Stripe
// can reach it unauthenticated. Security comes from signature verification.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return new Response("Stripe not configured", { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  // RAW body — never req.json(); re-serialization breaks the HMAC signature.
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe] webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;
    await markStripePaymentSucceeded(session.id, paymentIntentId);
  }

  return new Response(null, { status: 200 });
}
