import { NextResponse } from "next/server";
import { suggestMaterials } from "@/lib/materials";

export const runtime = "nodejs";

/** Autocomplete: distinct prior material names matching ?q=, with last price. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const suggestions = await suggestMaterials(q);
  return NextResponse.json({ suggestions });
}
