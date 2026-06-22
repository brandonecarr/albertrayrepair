/**
 * Single-admin session auth — intentionally tiny and dependency-free.
 *
 * WHY NOT NextAuth: the only user is Albert. A magic-link/OAuth stack would
 * need an email provider AND a database adapter just to sign in. Instead we
 * gate on one password (ADMIN_PASSWORD) and hand out an HMAC-signed,
 * expiring session cookie signed with AUTH_SECRET.
 *
 * Built on Web Crypto so the same code runs in edge middleware and in Node
 * route handlers. No imports from the DB layer — keep this edge-safe.
 *
 * GRACEFUL FALLBACK: if either env var is missing, `isAuthConfigured` is
 * false. The admin area then shows a setup notice instead of data, and the
 * middleware lets requests through to render it (there is nothing to protect
 * until the admin is actually configured).
 */

export const SESSION_COOKIE = "ar_admin";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const isAuthConfigured = Boolean(
  process.env.ADMIN_PASSWORD && process.env.AUTH_SECRET
);

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 ? 4 - (norm.length % 4) : 0;
  const bin = atob(norm + "=".repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(sig);
}

/** Constant-time-ish string compare to blunt timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True if the submitted password matches ADMIN_PASSWORD. */
export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

/** Create a signed `<payload>.<sig>` session token. */
export async function createSessionToken(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = b64urlEncode(encoder.encode(JSON.stringify({ exp })));
  const sig = b64urlEncode(await hmac(payload, secret));
  return `${payload}.${sig}`;
}

/** Verify a session token's signature and expiry. Edge-safe. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64urlEncode(await hmac(payload, secret));
  if (!safeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(decoder.decode(b64urlDecode(payload))) as { exp?: number };
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}
