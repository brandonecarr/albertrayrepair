import { NextResponse } from "next/server";
import { decideBooking } from "@/lib/scheduling";
import type { BookingStatus } from "@/lib/db/schema";

export const runtime = "nodejs";

const DECIDABLE: BookingStatus[] = ["confirmed", "declined", "cancelled"];

/** PATCH /api/admin/bookings/[id]  body: { status } */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (
    typeof body.status !== "string" ||
    !DECIDABLE.includes(body.status as BookingStatus)
  ) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const ok = await decideBooking(
    id,
    body.status as "confirmed" | "declined" | "cancelled"
  );
  if (!ok) {
    return NextResponse.json(
      { error: "Could not update booking. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
