/**
 * Build an invoice (a Quote record) from a job.
 *
 * Math: base price (the job's AMOUNT) + each company-purchased material, minus
 * an optional job discount. Client-purchased materials are listed at $0 — shown
 * for the record, never charged. The Quote's denormalized total handles the sum.
 */
import { getJobById } from "./jobs";
import { listJobMaterials } from "./materials";
import { createQuote, getQuote, type AdminQuote, type QuoteLineInput } from "./quotes";

function label(name: string, store: string | null): string {
  return store ? `${name} — ${store}` : name;
}

export async function createInvoiceFromJob(jobId: string): Promise<AdminQuote | null> {
  const job = await getJobById(jobId);
  if (!job) return null;

  const materials = await listJobMaterials(jobId);
  const lines: QuoteLineInput[] = [];

  // Base — what Albert is charging (the job AMOUNT field).
  lines.push({
    description: job.title || "Labor & service",
    quantity: 1,
    unitAmountCents: job.amountCents ?? 0,
  });

  // Company-purchased materials — charged.
  for (const m of materials) {
    if (m.purchaser !== "company") continue;
    lines.push({
      description: label(m.name, m.store),
      quantity: 1,
      unitAmountCents: m.priceCents,
    });
  }

  // Client-purchased materials — listed at $0 for the record, not charged.
  for (const m of materials) {
    if (m.purchaser !== "client") continue;
    lines.push({
      description: `${label(m.name, m.store)} (client-purchased)`,
      quantity: 1,
      unitAmountCents: 0,
    });
  }

  // Discount — subtracted from the total.
  if (job.discountCents && job.discountCents > 0) {
    lines.push({ description: "Discount", quantity: 1, unitAmountCents: -job.discountCents });
  }

  const quoteId = await createQuote({
    customerId: job.customerId,
    jobId: job.id,
    title: job.title,
    lineItems: lines,
  });
  return quoteId ? getQuote(quoteId) : null;
}
