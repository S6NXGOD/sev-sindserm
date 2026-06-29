/**
 * Sessão do administrador.
 *
 * Implementação propositalmente "edge-safe": usa apenas Web Crypto
 * (`crypto.subtle`), `TextEncoder` e operações de string. Assim o MESMO código
 * roda tanto nas Server Actions (Node) quanto no middleware (Edge runtime).
 *
 * O token é assinado com HMAC-SHA256: `${expiraEm}.${assinatura}`.
 * Não há tabela de sessão — a validade é auto-contida e verificável pela
 * assinatura, evitando falsificação sem o SESSION_SECRET.
 */

export const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 horas

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
}

const encoder = new TextEncoder();

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return bufferToHex(signature);
}

/** Comparação em tempo constante para evitar timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  const signature = await hmacHex(expiresAt);
  return `${expiresAt}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;

  const exp = Number(expiresAt);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = await hmacHex(expiresAt);
  return timingSafeEqual(signature, expected);
}

export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
