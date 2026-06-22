import { NextResponse } from "next/server";
import { addBlock } from "@/lib/scheduling";

export const runtime = "nodejs";

/** POST /api/admin/blocks  body: { date, time?, reason? } */
export async function POST(req: Request) {
  let body: { date?: unknown; time?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }
  const time = typeof body.time === "string" && body.time.trim() ? body.time.trim() : null;
  const reason =
    typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  const ok = await addBlock(body.date, time, reason);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not add block. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
