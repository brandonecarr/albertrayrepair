import { NextResponse } from "next/server";
import { createJobFromLead } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * Create a job from a lead and schedule it on the calendar. Protected by
 * middleware (admin session). Returns whether it landed on the calendar and
 * the date, so the client can jump to that week.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const result = await createJobFromLead(id);

  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "db_unconfigured"
          ? 503
          : 500;
    const error =
      result.reason === "not_found"
        ? "Lead not found."
        : result.reason === "db_unconfigured"
          ? "Database not configured."
          : "Could not create the job.";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({
    ok: true,
    jobId: result.jobId,
    date: result.date,
    onCalendar: result.onCalendar,
  });
}
