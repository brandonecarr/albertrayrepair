/**
 * Job receipts — photos of store receipts kept per job. Files live in Vercel
 * Blob (the production filesystem is read-only); this table holds the URL and
 * the blob pathname (for deletion). Everything degrades gracefully: with no DB
 * the list is empty; with no blob storage uploads are rejected with a clear
 * message. Reuses the same `hasBlobStorage` detection as the work gallery.
 */
import { desc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { jobReceipts } from "./db/schema";
import { hasBlobStorage } from "./work-photos";

export type AdminReceipt = {
  id: string;
  url: string;
  createdAt: string;
};

function toAdmin(r: typeof jobReceipts.$inferSelect): AdminReceipt {
  return { id: r.id, url: r.url, createdAt: r.createdAt.toISOString() };
}

export async function listJobReceipts(jobId: string): Promise<AdminReceipt[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(jobReceipts)
      .where(eq(jobReceipts.jobId, jobId))
      .orderBy(desc(jobReceipts.createdAt));
    return rows.map(toAdmin);
  } catch (err) {
    console.error("[receipts] failed to list:", err);
    return [];
  }
}

export type AddReceiptResult =
  | { ok: true; receipt: AdminReceipt }
  | { ok: false; reason: "db_unconfigured" | "blob_unconfigured" | "error"; message: string };

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — phone photos run large

/** Upload a receipt image to blob storage and record it against the job. */
export async function addJobReceipt(jobId: string, file: File): Promise<AddReceiptResult> {
  if (!isDbConfigured || !db) {
    return { ok: false, reason: "db_unconfigured", message: "Database not configured." };
  }
  if (!hasBlobStorage) {
    return {
      ok: false,
      reason: "blob_unconfigured",
      message: "Receipt storage isn't set up yet. Connect a Vercel Blob store to this project, then redeploy.",
    };
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return { ok: false, reason: "error", message: "Please upload a photo (JPG, PNG, HEIC, or WebP)." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "error", message: "That image is over 20 MB — please use a smaller photo." };
  }

  try {
    const { put } = await import("@vercel/blob");
    const safe = (file.name || "receipt").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
    const blob = await put(`receipts/${jobId}/${safe}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || "image/jpeg",
    });
    const inserted = await db
      .insert(jobReceipts)
      .values({ jobId, url: blob.url, pathname: blob.pathname })
      .returning();
    return { ok: true, receipt: toAdmin(inserted[0]!) };
  } catch (err) {
    console.error("[receipts] upload failed:", err);
    const detail = err instanceof Error ? err.message : "Upload failed.";
    return { ok: false, reason: "error", message: detail };
  }
}

/** Fetch a single receipt (used by the extract route). */
export async function getJobReceipt(id: string): Promise<AdminReceipt | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const rows = await db.select().from(jobReceipts).where(eq(jobReceipts.id, id)).limit(1);
    return rows[0] ? toAdmin(rows[0]) : null;
  } catch (err) {
    console.error("[receipts] failed to fetch:", err);
    return null;
  }
}

/** Delete a receipt (removes the blob file and the row). */
export async function deleteJobReceipt(id: string): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    const rows = await db.select().from(jobReceipts).where(eq(jobReceipts.id, id)).limit(1);
    const row = rows[0];
    if (!row) return false;
    if (hasBlobStorage) {
      try {
        const { del } = await import("@vercel/blob");
        await del(row.url);
      } catch (err) {
        console.error("[receipts] blob delete failed (removing row anyway):", err);
      }
    }
    await db.delete(jobReceipts).where(eq(jobReceipts.id, id));
    return true;
  } catch (err) {
    console.error("[receipts] delete failed:", err);
    return false;
  }
}
