/**
 * Database client (Neon Postgres + Drizzle).
 *
 * GRACEFUL FALLBACK: mirrors the notification layer. If DATABASE_URL is
 * not set, `db` is null and `isDbConfigured` is false — callers no-op and
 * log instead of throwing, so the site works end-to-end today. Provision
 * a Neon database, drop its connection string into DATABASE_URL, and
 * persistence switches on with no code changes.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

export const isDbConfigured = Boolean(url);

export const db = url ? drizzle(neon(url), { schema }) : null;

export * as schema from "./schema";
