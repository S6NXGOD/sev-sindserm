/**
 * Validação da foto de perfil recebida como DATA URL (base64). O redimensionamento
 * acontece no cliente (para ~256px), então aqui só barramos o que fugir do
 * esperado: precisa ser imagem e não pode ser gigante (proteção do banco/payload).
 */

// ~500KB de base64 (uma foto 256px JPEG fica muito abaixo disso).
const MAX_LEN = 700_000;

export type ResultadoFoto =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * `raw` pode ser:
 *  - "" (string vazia) → remover a foto (null)
 *  - data:image/...;base64,... → validar e aceitar
 *  - undefined/null → não veio no form
 */
export function validarFoto(raw: unknown): ResultadoFoto {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "") return { ok: true, value: null };
  if (!s.startsWith("data:image/")) {
    return { ok: false, error: "Formato de imagem inválido." };
  }
  if (s.length > MAX_LEN) {
    return { ok: false, error: "Imagem muito grande. Tente uma foto menor." };
  }
  return { ok: true, value: s };
}
