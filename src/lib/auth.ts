/**
 * Sessão do usuário do painel.
 *
 * Implementação propositalmente "edge-safe": usa apenas Web Crypto
 * (`crypto.subtle`), `TextEncoder` e operações de string. Assim o MESMO código
 * roda tanto nas Server Actions (Node) quanto no middleware (Edge runtime).
 *
 * O token carrega a IDENTIDADE e é assinado com HMAC-SHA256:
 *   `${userId}.${sessionVersion}.${expiraEm}.${assinatura}`
 * Não há tabela de sessão — a assinatura garante integridade (sem o
 * SESSION_SECRET não dá para forjar). A `sessionVersion` permite invalidar
 * sessões: o servidor (getCurrentUser) compara com a versão atual do usuário no
 * banco; ao incrementá-la, todas as sessões daquele usuário caem.
 *
 * NOTA: mudar este FORMATO invalida automaticamente todos os tokens antigos
 * (formato anterior era `${expiraEm}.${assinatura}`) — é o "deslogar todos" ao
 * migrar para a gestão de usuários.
 */

export const SESSION_COOKIE = "admin_session";
// Sessão PERSISTENTE: só termina no logout manual (botão "Sair"). O token vale
// por ~10 anos e o cookie é REEMITIDO a cada requisição no middleware (refresh
// deslizante), então o usuário nunca é deslogado por tempo de token/inatividade.
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 365 * 10; // ~10 anos

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

export type SessionPayload = {
  userId: string;
  sessionVersion: number;
  expiresAt: number;
};

/** Emite um token assinado para o usuário (com a versão de sessão dele). */
export async function createSessionToken(
  userId: string,
  sessionVersion: number,
): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const message = `${userId}.${sessionVersion}.${expiresAt}`;
  const signature = await hmacHex(message);
  return `${message}.${signature}`;
}

/**
 * Lê e valida o token (assinatura + expiração). Retorna o payload
 * (userId/sessionVersion) ou `null`. A checagem de usuário ATIVO e da versão de
 * sessão vigente é feita no servidor (getCurrentUser), com acesso ao banco —
 * aqui só validamos a integridade (edge-safe). `userId` é um cuid (sem pontos),
 * então o split por "." é seguro.
 */
export async function readSessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, versionStr, expiresAtStr, signature] = parts;
  if (!userId || !versionStr || !expiresAtStr || !signature) return null;

  const message = `${userId}.${versionStr}.${expiresAtStr}`;
  const expected = await hmacHex(message);
  if (!timingSafeEqual(signature, expected)) return null;

  const expiresAt = Number(expiresAtStr);
  const sessionVersion = Number(versionStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  if (!Number.isInteger(sessionVersion)) return null;

  return { userId, sessionVersion, expiresAt };
}

export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
