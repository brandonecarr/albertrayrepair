import { NextResponse } from "next/server";
import { reassignLead } from "@/lib/leads";

export const runtime = "nodejs";

/**
 * Move a lead to a different customer. Protected by middleware.
 * Body: { customerId }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: { customerId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.customerId !== "string" || !body.customerId) {
    return NextResponse.json({ error: "customerId is required." }, { status: 400 });
  }

  const ok = await reassignLead(id, body.customerId);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not reassign lead. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
