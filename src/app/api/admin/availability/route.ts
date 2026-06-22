import { NextResponse } from "next/server";
import {
  getWeeklyAvailability,
  setWeeklyAvailability,
  type DayAvailability,
} from "@/lib/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const days = await getWeeklyAvailability();
  return NextResponse.json({ days });
}

export async function PUT(req: Request) {
  let body: { days?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!Array.isArray(body.days)) {
    return NextResponse.json({ error: "Expected `days` array." }, { status: 400 });
  }

  // Validate + normalize each weekday entry.
  const days: DayAvailability[] = [];
  for (const raw of body.days) {
    const d = raw as Partial<DayAvailability>;
    if (
      typeof d.weekday !== "number" ||
      d.weekday < 0 ||
      d.weekday > 6 ||
      typeof d.enabled !== "boolean" ||
      !Array.isArray(d.slots) ||
      d.slots.some((s) => typeof s !== "string")
    ) {
      return NextResponse.json({ error: "Invalid day entry." }, { status: 400 });
    }
    days.push({
      weekday: d.weekday,
      enabled: d.enabled,
      slots: (d.slots as string[]).map((s) => s.trim()).filter(Boolean),
    });
  }

  const ok = await setWeeklyAvailability(days);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not save. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
