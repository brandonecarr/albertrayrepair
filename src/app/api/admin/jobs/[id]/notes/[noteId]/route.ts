import { NextResponse } from "next/server";
import { deleteJobNote } from "@/lib/jobs";

export const runtime = "nodejs";

/** Delete a job note. Protected by middleware (admin session). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; noteId: string }> }
) {
  const { noteId } = await ctx.params;
  const ok = await deleteJobNote(noteId);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not delete the note." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
