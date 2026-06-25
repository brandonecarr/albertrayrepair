import { NextResponse } from "next/server";
import { listCustomers } from "@/lib/customers";
import { cursorFromParams } from "@/lib/pagination";

export const runtime = "nodejs";

/** GET /api/admin/customers/list?beforeAt=&beforeId=  → next page of customers. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = await listCustomers({ before: cursorFromParams(searchParams) });
  return NextResponse.json(page);
}
