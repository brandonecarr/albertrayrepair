import { NextResponse } from "next/server";
import { updateNotification } from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * Update a notification (enable flag and/or template). Protected by middleware.
 * Body: { enabled?: boolean, subject?: string|null, body?: string }
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  const { key } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const patch: { enabled?: boolean; subject?: string | null; body?: string } = {};
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid enabled flag." }, { status: 400 });
    }
    patch.enabled = body.enabled;
  }
  if (body.subject !== undefined) {
    patch.subject =
      typeof body.subject === "string" && body.subject.trim() ? body.subject : null;
  }
  if (body.body !== undefined) {
    if (typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ error: "Message body can't be empty." }, { status: 400 });
    }
    patch.body = body.body;
  }

  const ok = await updateNotification(key, patch);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not save. Is the database connected?" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
