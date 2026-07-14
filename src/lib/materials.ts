/**
 * Job materials — what was used on a job, who paid, and the price. Material
 * names are reusable "tags": suggestMaterials() surfaces previously-entered
 * names (and their last price) for autocomplete. No-ops gracefully without a DB.
 */
import { desc, eq, ilike } from "drizzle-orm";
import { db, isDbConfigured } from "./db";
import { jobMaterials, type MaterialPurchaser } from "./db/schema";

export type AdminMaterial = {
  id: string;
  name: string;
  priceCents: number;
  purchaser: MaterialPurchaser;
  store: string | null;
  createdAt: string;
};

function toAdminMaterial(r: typeof jobMaterials.$inferSelect): AdminMaterial {
  return {
    id: r.id,
    name: r.name,
    priceCents: r.priceCents,
    purchaser: r.purchaser,
    store: r.store,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listJobMaterials(jobId: string): Promise<AdminMaterial[]> {
  if (!isDbConfigured || !db) return [];
  try {
    const rows = await db
      .select()
      .from(jobMaterials)
      .where(eq(jobMaterials.jobId, jobId))
      .orderBy(desc(jobMaterials.createdAt));
    return rows.map(toAdminMaterial);
  } catch (err) {
    console.error("[db] failed to list job materials:", err);
    return [];
  }
}

export async function addJobMaterial(
  jobId: string,
  input: { name: string; priceCents: number; purchaser: MaterialPurchaser; store?: string | null }
): Promise<AdminMaterial | null> {
  if (!isDbConfigured || !db) return null;
  try {
    const rows = await db
      .insert(jobMaterials)
      .values({
        jobId,
        name: input.name,
        priceCents: input.priceCents,
        purchaser: input.purchaser,
        store: input.store ?? null,
      })
      .returning();
    const r = rows[0];
    return r ? toAdminMaterial(r) : null;
  } catch (err) {
    console.error("[db] failed to add job material:", err);
    return null;
  }
}

export async function deleteJobMaterial(id: string): Promise<boolean> {
  if (!isDbConfigured || !db) return false;
  try {
    await db.delete(jobMaterials).where(eq(jobMaterials.id, id));
    return true;
  } catch (err) {
    console.error("[db] failed to delete job material:", err);
    return false;
  }
}

/** Distinct prior material names matching `query`, with their most recent price. */
export async function suggestMaterials(
  query: string
): Promise<{ name: string; priceCents: number }[]> {
  if (!isDbConfigured || !db) return [];
  const q = query.trim();
  if (!q) return [];
  try {
    const rows = await db
      .select({
        name: jobMaterials.name,
        priceCents: jobMaterials.priceCents,
      })
      .from(jobMaterials)
      .where(ilike(jobMaterials.name, `%${q}%`))
      .orderBy(desc(jobMaterials.createdAt))
      .limit(40);
    const seen = new Set<string>();
    const out: { name: string; priceCents: number }[] = [];
    for (const r of rows) {
      const key = r.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: r.name, priceCents: r.priceCents });
      if (out.length >= 8) break;
    }
    return out;
  } catch (err) {
    console.error("[db] failed to suggest materials:", err);
    return [];
  }
}
