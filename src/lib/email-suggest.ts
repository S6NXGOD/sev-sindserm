// Sugestão de correção de domínio de e-mail ("Você quis dizer …@gmail.com?").
// Pura, client/server-safe. Só SUGERE — nunca bloqueia (é um palpite gentil).

// Domínios comuns no Brasil. Ordem não importa (comparação por distância).
const DOMINIOS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.com.br",
  "hotmail.com.br",
  "outlook.com.br",
  "icloud.com",
  "live.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "globo.com",
  "ig.com.br",
  "msn.com",
  "me.com",
  "proton.me",
  "protonmail.com",
];

/** Distância de edição (Levenshtein) simples entre duas strings. */
function distancia(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const linha = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = linha[j];
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + custo);
      anterior = tmp;
    }
  }
  return linha[n];
}

/**
 * Se o domínio digitado for muito próximo de um domínio conhecido (mas não igual),
 * devolve o e-mail corrigido (mesma parte local + domínio conhecido). Senão, null.
 * Ex.: "joao@gmial.com" → "joao@gmail.com"; "joao@gmail.com" → null.
 */
export function suggestEmail(raw: string): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null; // sem local ou sem domínio
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain.length < 4 || !domain.includes(".")) return null;
  if (DOMINIOS.includes(domain)) return null; // já é um domínio conhecido

  let melhor: string | null = null;
  let menor = Infinity;
  for (const d of DOMINIOS) {
    const dist = distancia(domain, d);
    if (dist < menor) {
      menor = dist;
      melhor = d;
    }
  }
  // Limite conservador: domínios curtos só com 1 edição; longos, até 2 — evita
  // "corrigir" um domínio corporativo legítimo por engano.
  const limite = domain.length <= 8 ? 1 : 2;
  if (melhor && menor > 0 && menor <= limite) return `${local}@${melhor}`;
  return null;
}
