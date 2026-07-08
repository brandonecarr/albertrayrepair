/**
 * Work-gallery photos managed from the admin.
 *
 * Files are stored in Vercel Blob (not the repo — the production filesystem is
 * read-only), and this table holds the URL + caption + order. Everything
 * degrades gracefully: with no DB the admin manager is empty; with no
 * BLOB_READ_WRITE_TOKEN uploads are rejected with a clear message.
 */
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { workPhotos } from "./db/schema";

// Blob is usable via either a static read/write token OR Vercel's newer
// token-less OIDC flow (BLOB_STORE_ID + an auto-injected VERCEL_OIDC_TOKEN at
// runtime). Accept both so the uploader enables under either setup.
export const hasBlobStorage = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID
);

export type AdminWorkPhoto = {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
};

function toAdmin(r: typeof workPhotos.$inferSelect): AdminWorkPhoto {
  return {
    id: r.id,
    url: r.url,
    caption: r.caption,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
  };
}

/** All gallery photos in display order (sortOrder, then oldest first). */
export async function listWorkPhotos(): Promise<AdminWorkPhoto[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(workPhotos)
      .orderBy(asc(workPhotos.sortOrder), asc(workPhotos.createdAt));
    return rows.map(toAdmin);
  } catch (err) {
    console.error("[work-photos] failed to list:", err);
    return [];
  }
}

export type AddPhotoResult =
  | { ok: true; photo: AdminWorkPhoto }
  | { ok: false; reason: "db_unconfigured" | "blob_unconfigured" | "error"; message: string };

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

/** Upload a photo to blob storage and record it. */
export async function addWorkPhoto(
  file: File,
  caption: string | null
): Promise<AddPhotoResult> {
  if (!isDbConfigured || !db) {
    return { ok: false, reason: "db_unconfigured", message: "Database not configured." };
  }
  if (!hasBlobStorage) {
    return {
      ok: false,
      reason: "blob_unconfigured",
      message: "Photo storage isn't set up yet. Connect a Vercel Blob store to this project, then redeploy.",
    };
  }
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, reason: "error", message: "Please upload a JPG, PNG, WebP, or AVIF image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "error", message: "That image is over 12 MB — please use a smaller file." };
  }

  try {
    const { put } = await import("@vercel/blob");
    const safe = (file.name || "photo").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
    const blob = await put(`work/${safe}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    // Append to the end of the gallery.
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${workPhotos.sortOrder}), -1)` })
      .from(workPhotos);
    const nextOrder = Number(max) + 1;

    const inserted = await db
      .insert(workPhotos)
      .values({ url: blob.url, pathname: blob.pathname, caption, sortOrder: nextOrder })
      .returning();
    return { ok: true, photo: toAdmin(inserted[0]!) };
  } catch (err) {
    console.error("[work-photos] upload failed:", err);
    // Surface the real reason to the admin (this endpoint is auth-gated; the
    // underlying blob/storage message is safe and makes setup issues obvious).
    const detail = err instanceof Error ? err.message : "Upload failed.";
    return { ok: false, reason: "error", message: detail };
  }
}

/** Delete a photo (removes the blob file and the row). */
export async function deleteWorkPhoto(id: string): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    const rows = await db.select().from(workPhotos).where(eq(workPhotos.id, id)).limit(1);
    const row = rows[0];
    if (!row) return false;
    if (hasBlobStorage) {
      try {
        const { del } = await import("@vercel/blob");
        await del(row.url);
      } catch (err) {
        console.error("[work-photos] blob delete failed (removing row anyway):", err);
      }
    }
    await db.delete(workPhotos).where(eq(workPhotos.id, id));
    return true;
  } catch (err) {
    console.error("[work-photos] delete failed:", err);
    return false;
  }
}

/** Edit a photo's caption. */
export async function updateWorkPhotoCaption(id: string, caption: string | null): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    const res = await db
      .update(workPhotos)
      .set({ caption })
      .where(eq(workPhotos.id, id))
      .returning({ id: workPhotos.id });
    return res.length > 0;
  } catch (err) {
    console.error("[work-photos] caption update failed:", err);
    return false;
  }
}

/** Persist a new order (the full ordered list of ids). */
export async function reorderWorkPhotos(orderedIds: string[]): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(workPhotos).set({ sortOrder: i }).where(eq(workPhotos.id, orderedIds[i]!));
    }
    return true;
  } catch (err) {
    console.error("[work-photos] reorder failed:", err);
    return false;
  }
}

/** Public gallery shape (URL + caption only). */
export async function listPublicWorkPhotos(): Promise<{ url: string; caption: string | null }[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select({ url: workPhotos.url, caption: workPhotos.caption })
      .from(workPhotos)
      .orderBy(asc(workPhotos.sortOrder), desc(workPhotos.createdAt));
    return rows;
  } catch (err) {
    console.error("[work-photos] public list failed:", err);
    return [];
  }
}
