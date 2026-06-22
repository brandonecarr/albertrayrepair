import { NextResponse } from "next/server";
import { setLeadStatus, markLeadRead } from "@/lib/leads";
import type { LeadStatus } from "@/lib/db/schema";

export const runtime = "nodejs";

const VALID_STATUSES: LeadStatus[] = ["new", "contacted", "won", "lost"];

/**
 * Update a single lead. Protected by middleware (admin session required).
 * Body: { status?: LeadStatus, markRead?: true }
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: { status?: unknown; markRead?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.markRead === true) {
    await markLeadRead(id);
  }

  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !VALID_STATUSES.includes(body.status as LeadStatus)
    ) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    const ok = await setLeadStatus(id, body.status as LeadStatus);
    if (!ok) {
      return NextResponse.json(
        { error: "Could not update lead. Is the database configured?" },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
