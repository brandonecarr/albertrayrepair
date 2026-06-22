import { NextResponse } from "next/server";
import { mergeCustomers } from "@/lib/customers";

export const runtime = "nodejs";

/**
 * Merge a duplicate customer into this one (the primary). Protected by
 * middleware. Body: { duplicateId }. Reassigns all leads/jobs/quotes/payments
 * and deletes the duplicate.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params; // primary

  let body: { duplicateId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.duplicateId !== "string" || !body.duplicateId) {
    return NextResponse.json({ error: "duplicateId is required." }, { status: 400 });
  }

  const result = await mergeCustomers(id, body.duplicateId);
  if (!result.ok) {
    if (result.reason === "same") {
      return NextResponse.json(
        { error: "Can't merge a customer into themselves." },
        { status: 400 }
      );
    }
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Could not merge customers. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
