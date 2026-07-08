import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deleteWorkPhoto, updateWorkPhotoCaption } from "@/lib/work-photos";

export const runtime = "nodejs";

/** PATCH /api/admin/work-photos/[id]  body: { caption } */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { caption?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const caption =
    typeof body.caption === "string" && body.caption.trim() ? body.caption.trim() : null;
  const ok = await updateWorkPhotoCaption(id, caption);
  if (!ok) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/work-photos/[id] */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await deleteWorkPhoto(id);
  if (!ok) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
