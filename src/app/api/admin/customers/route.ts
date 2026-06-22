import { NextResponse } from "next/server";
import { createCustomer } from "@/lib/customers";

export const runtime = "nodejs";

/**
 * Manually create a customer. Protected by middleware (admin session).
 * Body: { name, phone?, email?, address?, notes? }
 * Returns { ok, id, existed } — `existed` is true when a dedupe match was hit.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "A name is required." }, { status: 400 });
  }

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const result = await createCustomer({
    name: body.name.trim(),
    phone: str(body.phone),
    email: str(body.email),
    address: str(body.address),
    notes: str(body.notes),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Could not create customer. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, id: result.id, existed: result.existed });
}
