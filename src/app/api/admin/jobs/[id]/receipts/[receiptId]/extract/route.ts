import { NextResponse } from "next/server";
import { getJobReceipt } from "@/lib/receipts";
import { extractReceipt, hasReceiptExtraction } from "@/lib/receipt-extract";
import { addJobMaterial } from "@/lib/materials";
import type { AdminMaterial } from "@/lib/materials";

export const runtime = "nodejs";
// Vision extraction can take a few seconds; give the function room.
export const maxDuration = 60;

/**
 * Read a receipt image with Claude vision and auto-add its line items as
 * materials on the job. Returns the created materials so the UI can append them.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; receiptId: string }> }
) {
  const { id, receiptId } = await ctx.params;

  if (!hasReceiptExtraction) {
    return NextResponse.json(
      { error: "Receipt reading isn't set up yet. Add an ANTHROPIC_API_KEY to enable it." },
      { status: 503 }
    );
  }

  const receipt = await getJobReceipt(receiptId);
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const extracted = await extractReceipt(receipt.url);
  if (!extracted) {
    return NextResponse.json(
      { error: "Couldn't read that receipt. Try a clearer photo, or add items by hand." },
      { status: 502 }
    );
  }
  if (extracted.items.length === 0) {
    return NextResponse.json(
      { error: "No line items were found on that receipt." },
      { status: 422 }
    );
  }

  const added: AdminMaterial[] = [];
  for (const item of extracted.items) {
    const material = await addJobMaterial(id, {
      name: item.name,
      priceCents: item.priceCents,
      purchaser: "company",
      store: extracted.store,
    });
    if (material) added.push(material);
  }

  if (added.length === 0) {
    return NextResponse.json(
      { error: "Read the receipt, but couldn't save the items. Is the database connected?" },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, store: extracted.store, materials: added });
}
