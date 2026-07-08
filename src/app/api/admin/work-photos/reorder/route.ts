import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { reorderWorkPhotos } from "@/lib/work-photos";

export const runtime = "nodejs";

/** POST /api/admin/work-photos/reorder  body: { ids: string[] } */
export async function POST(req: Request) {
  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!Array.isArray(body.ids) || !body.ids.every((x) => typeof x === "string")) {
    return NextResponse.json({ error: "Expected an array of photo ids." }, { status: 400 });
  }
  const ok = await reorderWorkPhotos(body.ids as string[]);
  if (!ok) return NextResponse.json({ error: "Could not reorder." }, { status: 503 });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
