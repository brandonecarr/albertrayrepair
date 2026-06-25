import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { removeBlock } from "@/lib/scheduling";

export const runtime = "nodejs";

/** DELETE /api/admin/blocks/[id] */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!isDbConfigured) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const ok = await removeBlock(id);
  if (!ok) {
    return NextResponse.json(
      { error: "That block no longer exists." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
