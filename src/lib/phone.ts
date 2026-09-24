// Utilidades de telefone brasileiro. Puras (client/server-safe). Servem para a
// MÁSCARA no formulário e para a VALIDAÇÃO/detecção de anomalias na auditoria.

export function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Formata progressivamente como (99) 99999-9999 (celular) ou (99) 9999-9999
 * (fixo). Tolerante a valores parciais — bom para máscara em tempo real.
 */
export function formatPhoneBr(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Valida um telefone BR: 10 (fixo) ou 11 (celular) dígitos, DDD 11–99, celular
 * começando com 9, e rejeita sequências de um único dígito (00000000000). NÃO é
 * garantia de que o número existe — só filtra o obviamente inválido/falso.
 */
export function isValidPhoneBr(raw: string | null | undefined): boolean {
  const d = onlyDigits(raw);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d.length === 11 && d[2] !== "9") return false;
  if (/^(\d)\1+$/.test(d)) return false; // todos os dígitos iguais
  return true;
}
