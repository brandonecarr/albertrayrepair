import { NextResponse } from "next/server";
import { addJobMaterial } from "@/lib/materials";
import { dollarsToCentsStrict } from "@/lib/money";
import type { MaterialPurchaser } from "@/lib/db/schema";

export const runtime = "nodejs";

/** Add a material to a job. Body: { name, priceDollars, purchaser }. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

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

  const purchaser: MaterialPurchaser =
    body.purchaser === "client" ? "client" : "company";

  const material = await addJobMaterial(id, {
    name: body.name.trim(),
    priceCents,
    purchaser,
  });
  if (!material) {
    return NextResponse.json(
      { error: "Could not add the material. Is the database connected?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, material });
}
