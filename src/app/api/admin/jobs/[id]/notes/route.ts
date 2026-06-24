import { NextResponse } from "next/server";
import { addJobNote } from "@/lib/jobs";

export const runtime = "nodejs";

/** Add a timestamped note to a job. Body: { body: string }. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: { body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "Note can't be empty." }, { status: 400 });
  }

  const note = await addJobNote(id, body.body.trim());
  if (!note) {
    return NextResponse.json(
      { error: "Could not add the note. Is the database connected?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, note });
}
