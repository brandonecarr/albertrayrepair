import { NextResponse } from "next/server";
import { createInvoiceFromJob } from "@/lib/invoices";

export const runtime = "nodejs";

/** POST /api/admin/jobs/[id]/invoice — generate an invoice (quote) from the job. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const quote = await createInvoiceFromJob(id);
  if (!quote) {
    return NextResponse.json(
      { error: "Could not create the invoice. Is the database connected?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, quote });
}
