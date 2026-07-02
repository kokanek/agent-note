import type { Context, Next } from "hono";
import type { Bindings } from "./env";

const encoder = new TextEncoder();

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.byteLength !== bb.byteLength) return false;
  return crypto.subtle.timingSafeEqual(ab, bb);
}

/** Bearer-key auth for /api/*. The web UI and the agent present the same key. */
export async function requireApiKey(c: Context<Bindings>, next: Next) {
  const auth = c.req.header("Authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!c.env.API_KEY || !key || !timingSafeEqualStr(key, c.env.API_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const byte of new Uint8Array(buf)) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Short-lived, note-scoped tokens for the /raw/:id iframe URL. The API key
// itself must never appear in an iframe src: a malicious HTML note can read
// its own location and exfiltrate whatever the URL carries. A token that only
// grants "read this one note for two minutes" is worthless to steal.
const RAW_TOKEN_TTL_MS = 2 * 60 * 1000;

export async function signRawToken(secret: string, noteId: string) {
  const exp = Date.now() + RAW_TOKEN_TTL_MS;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${noteId}.${exp}`),
  );
  return { token: `${exp}.${b64url(sig)}`, expires_at: exp };
}

export async function verifyRawToken(
  secret: string,
  noteId: string,
  token: string,
): Promise<boolean> {
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const key = await hmacKey(secret);
  const expected = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${noteId}.${exp}`),
  );
  return timingSafeEqualStr(token.slice(dot + 1), b64url(expected));
}
