import { NextResponse } from "next/server";
import { createJobFromBooking } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * Convert a booking into a tracked job. Protected by middleware (admin
 * session). Idempotent — returns the existing job if one is already linked.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const result = await createJobFromBooking(id);

  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "db_unconfigured"
          ? 503
          : 500;
    const error =
      result.reason === "not_found"
        ? "Booking not found."
        : result.reason === "db_unconfigured"
          ? "Database not configured."
          : "Could not create job from booking.";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    customerId: result.customerId,
    alreadyExisted: result.alreadyExisted,
  });
}
