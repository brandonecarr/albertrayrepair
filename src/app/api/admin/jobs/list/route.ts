import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";
import { cursorFromParams } from "@/lib/pagination";

export const runtime = "nodejs";

/** GET /api/admin/jobs/list?beforeAt=&beforeId=  → next page of jobs. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = await listJobs({ before: cursorFromParams(searchParams) });
  return NextResponse.json(page);
}
