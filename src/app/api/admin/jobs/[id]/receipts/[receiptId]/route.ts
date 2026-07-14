import { NextResponse } from "next/server";
import { deleteJobReceipt } from "@/lib/receipts";

export const runtime = "nodejs";

/** Delete a receipt (removes the stored image and the row). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; receiptId: string }> }
) {
  const { receiptId } = await ctx.params;
  const ok = await deleteJobReceipt(receiptId);
  if (!ok) {
    return NextResponse.json({ error: "Could not delete the receipt." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
