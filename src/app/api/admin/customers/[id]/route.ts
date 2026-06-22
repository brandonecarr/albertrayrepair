import { NextResponse } from "next/server";
import { updateCustomer } from "@/lib/customers";

export const runtime = "nodejs";

/**
 * Update a single customer. Protected by middleware (admin session required).
 * Body: { name?, phone?, email?, address?, notes? }
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const str = (v: unknown): string | null | undefined =>
    v === undefined ? undefined : typeof v === "string" ? v.trim() || null : null;

  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const ok = await updateCustomer(id, {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    phone: str(body.phone),
    email: str(body.email),
    address: str(body.address),
    notes: str(body.notes),
  });

  if (!ok) {
    return NextResponse.json(
      { error: "Could not update customer. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
