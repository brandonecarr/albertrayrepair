import { NextResponse } from "next/server";
import { getQuote } from "@/lib/quotes";
import { getCustomer } from "@/lib/customers";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

/** GET /api/admin/invoices/[id]/pdf?variant=paid — download the invoice PDF. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const paid = new URL(req.url).searchParams.get("variant") === "paid";

  const invoice = await getQuote(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const customer = await getCustomer(invoice.customerId);
  const pdf = await renderInvoicePdf(invoice, customer, paid);

  const filename = `invoice-${invoice.number}${paid ? "-paid" : ""}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
