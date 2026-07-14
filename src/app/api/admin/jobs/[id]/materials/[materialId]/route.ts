import { NextResponse } from "next/server";
import { deleteJobMaterial, updateJobMaterial } from "@/lib/materials";
import { dollarsToCentsStrict } from "@/lib/money";
import type { MaterialPurchaser } from "@/lib/db/schema";

export const runtime = "nodejs";

/** Edit a material. Body: { name, priceDollars, purchaser, store }. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; materialId: string }> }
) {
  const { materialId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Material name is required." }, { status: 400 });
  }

  let priceCents = 0;
  if (body.priceDollars !== undefined && body.priceDollars !== null && body.priceDollars !== "") {
    const cents = dollarsToCentsStrict(body.priceDollars);
    if (Number.isNaN(cents)) {
      return NextResponse.json({ error: "Invalid price." }, { status: 400 });
    }
    priceCents = cents;
  }

  const purchaser: MaterialPurchaser = body.purchaser === "client" ? "client" : "company";
  const store =
    typeof body.store === "string" && body.store.trim() ? body.store.trim().slice(0, 120) : null;

  const material = await updateJobMaterial(materialId, {
    name: body.name.trim(),
    priceCents,
    purchaser,
    store,
  });
  if (!material) {
    return NextResponse.json({ error: "Could not update the material." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, material });
}

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
