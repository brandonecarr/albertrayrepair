/**
 * Payments + Stripe.
 *
 * GRACEFUL FALLBACK (mirrors notify.ts / db): with no STRIPE_SECRET_KEY,
 * `getStripe()` returns null and the card path no-ops with a 503 upstream —
 * manual cash/check payments still work, and the rest of the app is unaffected.
 *
 * Card payments use Stripe HOSTED Checkout, so no card data ever touches this
 * app. A `pending` payment row is written when the Checkout Session is created
 * and flipped to `succeeded` by the webhook (idempotent via the unique
 * stripe_session_id). Lifetime spend = Σ amountCents where status='succeeded'.
 */
import Stripe from "stripe";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import {
  payments,
  jobs,
  type PaymentMethod,
  type PaymentStatus,
} from "./db/schema";
import { getQuote } from "./quotes";

export const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

let _stripe: Stripe | null = null;
/** Lazy Stripe client. Returns null when STRIPE_SECRET_KEY is unset. */
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

// ─── Types ────────────────────────────────────────────────────────────────

export type AdminPayment = {
  id: string;
  customerId: string;
  quoteId: string | null;
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  createdAt: string;
  paidAt: string | null;
};

function toPayment(p: typeof payments.$inferSelect): AdminPayment {
  return {
    id: p.id,
    customerId: p.customerId,
    quoteId: p.quoteId,
    amountCents: p.amountCents,
    method: p.method,
    status: p.status,
    reference: p.reference,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  };
}

// ─── Stripe Checkout ────────────────────────────────────────────────────────

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "stripe_unconfigured" | "not_found" | "empty" | "error" };

/**
 * Create a hosted Stripe Checkout link for a quote. Each quote line is
 * collapsed to quantity 1 with unit_amount = lineTotalCents (Stripe quantities
 * must be integers; collapsing dodges fractional hours). A `pending` payment is
 * recorded keyed on the session id so the webhook can reconcile it.
 */
export async function createCheckoutLink(quoteId: string): Promise<CheckoutResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, reason: "stripe_unconfigured" };
  if (!isDbConfigured || !db) return { ok: false, reason: "stripe_unconfigured" };

  const quote = await getQuote(quoteId);
  if (!quote) return { ok: false, reason: "not_found" };
  if (quote.totalCents <= 0) return { ok: false, reason: "empty" };

  try {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      quote.lineItems.map((li) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: li.lineTotalCents,
          product_data: {
            name:
              li.quantity === 1
                ? li.description
                : `${li.description} — ${li.quantity} @ ${(li.unitAmountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
          },
        },
      }));
    if (quote.taxCents && quote.taxCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: quote.taxCents,
          product_data: { name: "Tax" },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${baseUrl()}/?payment=success`,
      cancel_url: `${baseUrl()}/?payment=cancelled`,
      metadata: { quoteId: quote.id, customerId: quote.customerId },
    });

    if (session.amount_total !== quote.totalCents) {
      console.warn(
        `[payments] Stripe total ${session.amount_total} != quote total ${quote.totalCents} for quote ${quote.id}`
      );
    }

    // Record the intent as a pending payment for later reconciliation.
    await db.insert(payments).values({
      customerId: quote.customerId,
      quoteId: quote.id,
      amountCents: quote.totalCents,
      method: "card_stripe",
      status: "pending",
      stripeSessionId: session.id,
    });

    return { ok: true, url: session.url! };
  } catch (err) {
    console.error("[payments] failed to create checkout link:", err);
    return { ok: false, reason: "error" };
  }
}

/** Flip a Stripe payment to succeeded (webhook). Idempotent on session id. */
export async function markStripePaymentSucceeded(
  sessionId: string,
  paymentIntentId: string | null
): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    await db
      .update(payments)
      .set({
        status: "succeeded",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      })
      .where(
        and(
          eq(payments.stripeSessionId, sessionId),
          eq(payments.status, "pending")
        )
      );
    return true;
  } catch (err) {
    console.error("[payments] failed to mark stripe payment succeeded:", err);
    return false;
  }
}

// ─── Manual payments ────────────────────────────────────────────────────────

export type ManualPaymentInput = {
  customerId: string;
  quoteId?: string | null;
  amountCents: number;
  method: Extract<PaymentMethod, "cash" | "check" | "other">;
  reference?: string | null;
};

/** Record a payment collected outside Stripe (cash/check/other). */
export async function recordManualPayment(
  input: ManualPaymentInput
): Promise<string | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const rows = await db
      .insert(payments)
      .values({
        customerId: input.customerId,
        quoteId: input.quoteId ?? null,
        amountCents: input.amountCents,
        method: input.method,
        status: "succeeded",
        reference: input.reference ?? null,
        paidAt: new Date(),
      })
      .returning({ id: payments.id });
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[payments] failed to record manual payment:", err);
    return null;
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────

/** Payments for one customer, newest first. */
export async function listPaymentsForCustomer(
  customerId: string
): Promise<AdminPayment[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.customerId, customerId))
      .orderBy(desc(payments.createdAt));
    return rows.map(toPayment);
  } catch (err) {
    console.error("[payments] failed to list payments:", err);
    return [];
  }
}

/** Lifetime spend (cents) — sum of succeeded payments. */
/**
 * Lifetime spend = total value of the customer's finished work: the sum of
 * `amountCents` for jobs that have been marked completed or invoiced. Updates
 * the moment a job is moved to completed.
 */
export async function getCustomerLifetimeSpendCents(
  customerId: string
): Promise<number> {
  if (!isDbConfigured || !db) return 0;
  try {
    const rows = await db
      .select({
        total: sql<number>`coalesce(sum(${jobs.amountCents}), 0)`,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.customerId, customerId),
          inArray(jobs.status, ["completed", "invoiced"])
        )
      );
    return Number(rows[0]?.total ?? 0);
  } catch (err) {
    console.error("[db] failed to compute lifetime spend:", err);
    return 0;
  }
}
