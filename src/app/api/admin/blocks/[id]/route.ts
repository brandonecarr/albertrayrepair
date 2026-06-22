import { NextResponse } from "next/server";
import { removeBlock } from "@/lib/scheduling";

export const runtime = "nodejs";

/** DELETE /api/admin/blocks/[id] */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ok = await removeBlock(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not remove block. Is the database configured?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
