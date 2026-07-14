import { NextResponse } from "next/server";
import { addJobReceipt } from "@/lib/receipts";

export const runtime = "nodejs";

/** Upload a receipt photo for a job. Body: multipart/form-data with `file`. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const result = await addJobReceipt(id, file);
  if (!result.ok) {
    const status = result.reason === "blob_unconfigured" ? 503 : result.reason === "db_unconfigured" ? 503 : 400;
    return NextResponse.json({ error: result.message }, { status });
  }
  return NextResponse.json({ ok: true, receipt: result.receipt });
}
