import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/availability?date=YYYY-MM-DD → { closed, slots } */
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid or missing date." }, { status: 400 });
  }
  const result = await getAvailableSlots(date);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
