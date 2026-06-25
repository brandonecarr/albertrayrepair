import { NextResponse } from "next/server";
import { searchCustomers } from "@/lib/customers";

export const runtime = "nodejs";

/** GET /api/admin/customers/search?q=&exclude=  → up to 8 matching customers. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const exclude = searchParams.get("exclude") ?? undefined;
  const rawLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 8;
  const results = await searchCustomers(q, { excludeId: exclude, limit });
  return NextResponse.json({ results });
}
