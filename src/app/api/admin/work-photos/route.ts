import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addWorkPhoto } from "@/lib/work-photos";

export const runtime = "nodejs";

/** POST /api/admin/work-photos — multipart form: file (+ optional caption). */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  }
  const captionRaw = form.get("caption");
  const caption = typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim() : null;

  const result = await addWorkPhoto(file, caption);
  if (!result.ok) {
    const status =
      result.reason === "db_unconfigured" || result.reason === "blob_unconfigured" ? 503 : 400;
    return NextResponse.json({ error: result.message }, { status });
  }
  revalidatePath("/");
  return NextResponse.json({ photo: result.photo });
}
