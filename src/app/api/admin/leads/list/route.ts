import { NextResponse } from "next/server";
import { listLeads } from "@/lib/leads";
import { cursorFromParams } from "@/lib/pagination";

export const runtime = "nodejs";

/** GET /api/admin/leads/list?beforeAt=&beforeId=  → next page of leads. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = await listLeads({ before: cursorFromParams(searchParams) });
  return NextResponse.json(page);
}
