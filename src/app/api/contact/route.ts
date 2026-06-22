import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/validation";
import { notifyNewContact } from "@/lib/notify";
import { saveContactLead } from "@/lib/leads";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!rateLimit(`contact:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { error: "Please check the form and try again.", fieldErrors },
      { status: 400 }
    );
  }

  // Honeypot: a real user never fills `company`. If present, accept the
  // request (return ok so the bot sees success) but silently drop it.
  if (parsed.data.company) {
    return NextResponse.json({ ok: true });
  }

  await saveContactLead(parsed.data);
  await notifyNewContact(parsed.data);
  return NextResponse.json({ ok: true });
}
