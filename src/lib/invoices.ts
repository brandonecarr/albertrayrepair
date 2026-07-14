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
  const baseCents = job.amountCents ?? 0;
  lines.push({
    description: job.title || "Labor & service",
    quantity: 1,
    unitAmountCents: baseCents,
  });

  // Company-purchased materials — charged.
  let companyTotal = 0;
  for (const m of materials) {
    if (m.purchaser !== "company") continue;
    companyTotal += m.priceCents;
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

  // Discount — fixed dollars or a percent of the charged subtotal (base +
  // company materials). Never more than the subtotal itself.
  const chargedSubtotal = baseCents + companyTotal;
  let discountCents = 0;
  let discountLabel = "Discount";
  if (job.discountType === "fixed" && job.discountCents && job.discountCents > 0) {
    discountCents = Math.min(job.discountCents, chargedSubtotal);
  } else if (job.discountType === "percent" && job.discountBps && job.discountBps > 0) {
    discountCents = Math.min(
      Math.round((chargedSubtotal * job.discountBps) / 10000),
      chargedSubtotal
    );
    discountLabel = `Discount (${job.discountBps / 100}%)`;
  }
  if (discountCents > 0) {
    lines.push({ description: discountLabel, quantity: 1, unitAmountCents: -discountCents });
  }

  const quoteId = await createQuote({
    customerId: job.customerId,
    jobId: job.id,
    title: job.title,
    lineItems: lines,
  });
  return quoteId ? getQuote(quoteId) : null;
}
