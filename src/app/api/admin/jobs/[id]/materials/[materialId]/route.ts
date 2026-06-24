import { NextResponse } from "next/server";
import { deleteJobMaterial } from "@/lib/materials";

export const runtime = "nodejs";

/** Remove a material from a job. Protected by middleware (admin session). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; materialId: string }> }
) {
  const { materialId } = await ctx.params;
  const ok = await deleteJobMaterial(materialId);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not remove the material." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
