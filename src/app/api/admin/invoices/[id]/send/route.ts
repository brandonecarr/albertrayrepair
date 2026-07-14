import { NextResponse } from "next/server";
import { getQuote } from "@/lib/quotes";
import { getCustomer } from "@/lib/customers";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { sendEmailWithAttachment, sendSmsTo } from "@/lib/notify";
import { hasBlobStorage } from "@/lib/work-photos";
import { site } from "@/lib/site-config";

export const runtime = "nodejs";

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

/** POST /api/admin/invoices/[id]/send  body: { channel: 'email'|'sms', variant?: 'paid' } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { channel?: unknown; variant?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const channel = body.channel === "sms" ? "sms" : body.channel === "email" ? "email" : null;
  if (!channel) {
    return NextResponse.json({ error: "Pick email or text." }, { status: 400 });
  }
  const paid = body.variant === "paid";

  const invoice = await getQuote(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const customer = await getCustomer(invoice.customerId);
  const firstName = customer?.name?.split(" ")[0] || "there";
  const filename = `invoice-${invoice.number}${paid ? "-paid" : ""}.pdf`;

  const pdf = await renderInvoicePdf(invoice, customer, paid);

  if (channel === "email") {
    if (!customer?.email) {
      return NextResponse.json(
        { error: "This customer has no email on file. Add one, or send by text." },
        { status: 400 }
      );
    }
    const subject = paid
      ? `Paid invoice #${invoice.number} — ${site.name}`
      : `Invoice #${invoice.number} from ${site.name}`;
    const text = paid
      ? `Hi ${firstName},\n\nThank you for your payment! Your paid invoice #${invoice.number} is attached.\n\n— ${site.name}\n${site.phoneDisplay}`
      : `Hi ${firstName},\n\nPlease find invoice #${invoice.number} attached — total ${money(invoice.totalCents)}.\n\nQuestions? Call ${site.phoneDisplay}.\n\n— ${site.name}`;
    const result = await sendEmailWithAttachment(customer.email, subject, text, pdf, filename);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, sentTo: customer.email });
  }

  // SMS: host the PDF and text a link (a text can't carry an attachment).
  if (!customer?.phone) {
    return NextResponse.json(
      { error: "This customer has no phone on file. Add one, or send by email." },
      { status: 400 }
    );
  }
  if (!hasBlobStorage) {
    return NextResponse.json(
      { error: "Texting an invoice needs file storage (connect Vercel Blob)." },
      { status: 503 }
    );
  }
  let url: string;
  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(`invoices/${filename}`, pdf, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/pdf",
    });
    url = blob.url;
  } catch (err) {
    console.error("[invoice] blob upload failed:", err);
    return NextResponse.json({ error: "Couldn't prepare the invoice link." }, { status: 502 });
  }

  const smsBody = paid
    ? `${site.name}: your paid invoice #${invoice.number} — ${url}`
    : `${site.name}: your invoice #${invoice.number} for ${money(invoice.totalCents)} — ${url}`;
  const result = await sendSmsTo(customer.phone, smsBody);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: customer.phone });
}
