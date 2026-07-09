/**
 * DIAGNÓSTICO (somente leitura) — Locais e candidatos duplicados.
 *
 * Script PROVISÓRIO para auditar a base antes de qualquer limpeza. NÃO altera
 * nada: só faz SELECTs e imprime um relatório. Seguro para rodar em produção.
 *
 *   npx tsx prisma/verificar-duplicados.ts            (todos os anos)
 *   npx tsx prisma/verificar-duplicados.ts 2026       (só o ano informado)
 *
 * O que detecta:
 *   1) Locais (Workplace) com nome IGUAL (após normalizar acento/caixa/espaço),
 *      dentro do mesmo ano de eleição.
 *   2) Locais com nome SIMILAR (parecido, mas não idêntico) — pega erros de
 *      digitação/abreviação. Usa distância de Levenshtein.
 *   3) Candidatos com nome repetido DENTRO do mesmo local.
 *
 * A par com verificar-duplicados, a exclusão fica em outro script (dry-run por
 * padrão) para não misturar leitura com escrita.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Limiar de similaridade (0..1) para considerar dois nomes de local "parecidos".
const LIMIAR_SIMILAR = 0.86;

/** Normaliza: remove acentos, baixa a caixa, tira pontuação e colapsa espaços. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chave de igualdade EXATA (só apara/colapsa espaços; mantém caixa e acento).
 * É a MESMA usada em limpar-duplicados.ts: só o que casa aqui será removido.
 */
function chaveExata(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Distância de edição (Levenshtein) entre duas strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const linha = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = linha[j];
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + custo);
      anterior = temp;
    }
  }
  return linha[n];
}

/** Similaridade normalizada 0..1 (1 = idêntico). */
function similaridade(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

async function main() {
  const anoArg = process.argv[2] ? Number(process.argv[2]) : null;
  if (anoArg !== null && Number.isNaN(anoArg)) {
    console.error(`Ano inválido: "${process.argv[2]}". Use um número (ex.: 2026).`);
    process.exit(1);
  }

  const locais = await prisma.workplace.findMany({
    where: anoArg !== null ? { anoEleicao: anoArg } : undefined,
    select: {
      id: true,
      nome: true,
      orgao: true,
      zona: true,
      anoEleicao: true,
      _count: { select: { candidates: true, votes: true, voters: true } },
    },
    orderBy: [{ anoEleicao: "asc" }, { nome: "asc" }],
  });

  let alvo = "(DATABASE_URL ausente ou inválido)";
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    alvo = `${u.host}${u.pathname}`;
  } catch {}

  console.log("═".repeat(64));
  console.log(
    `DIAGNÓSTICO DE DUPLICADOS ${anoArg !== null ? `— ano ${anoArg}` : "— todos os anos"}`,
  );
  console.log(`Banco alvo: ${alvo}`);
  console.log(`Total de locais analisados: ${locais.length}`);
  console.log("═".repeat(64));

  // Agrupa por ano para não comparar locais de eleições diferentes.
  const porAno = new Map<number, typeof locais>();
  for (const l of locais) {
    const arr = porAno.get(l.anoEleicao) ?? [];
    arr.push(l);
    porAno.set(l.anoEleicao, arr);
  }

  let totalGruposExatos = 0;
  let totalParesSimilares = 0;

  for (const [ano, doAno] of [...porAno.entries()].sort((a, b) => a[0] - b[0])) {
    // 1) Locais com nome IGUAL (normalizado).
    const grupos = new Map<string, typeof doAno>();
    for (const l of doAno) {
      const chave = normalizar(l.nome);
      const arr = grupos.get(chave) ?? [];
      arr.push(l);
      grupos.set(chave, arr);
    }
    const exatos = [...grupos.values()].filter((g) => g.length > 1);

    if (exatos.length > 0) {
      console.log(`\n【 ${ano} 】 LOCAIS COM NOME IGUAL (${exatos.length} grupo(s))`);
      for (const g of exatos) {
        totalGruposExatos++;
        // A limpeza só remove nomes EXATAMENTE iguais. Se o grupo tiver variações
        // de caixa/acento, ela trata só as cópias exatas entre si — avisa aqui.
        const chavesExatas = new Set(g.map((l) => chaveExata(l.nome)));
        const marca =
          chavesExatas.size === 1
            ? "→ exato: a limpeza remove as cópias"
            : "→ varia caixa/acento: a limpeza NÃO trata como igual";
        console.log(`\n  • "${g[0].nome}"  (${g.length} cópias)  ${marca}`);
        for (const l of g) {
          console.log(
            `      - id=${l.id}  órgão=${l.orgao}  zona=${l.zona}  ` +
              `cand=${l._count.candidates} votos=${l._count.votes} votantes=${l._count.voters}`,
          );
        }
      }
    }

    // 2) Locais com nome SIMILAR (parecido, chaves normalizadas diferentes).
    const chavesUnicas = [...grupos.keys()];
    const similares: Array<[string, string, number]> = [];
    for (let i = 0; i < chavesUnicas.length; i++) {
      for (let j = i + 1; j < chavesUnicas.length; j++) {
        const s = similaridade(chavesUnicas[i], chavesUnicas[j]);
        if (s >= LIMIAR_SIMILAR) {
          similares.push([chavesUnicas[i], chavesUnicas[j], s]);
        }
      }
    }
    if (similares.length > 0) {
      console.log(
        `\n【 ${ano} 】 LOCAIS COM NOME SIMILAR (${similares.length} par(es), limiar ${LIMIAR_SIMILAR})`,
      );
      for (const [a, b, s] of similares.sort((x, y) => y[2] - x[2])) {
        totalParesSimilares++;
        const nomeA = grupos.get(a)![0].nome;
        const nomeB = grupos.get(b)![0].nome;
        console.log(`  ~ ${(s * 100).toFixed(0)}%  "${nomeA}"  ⇄  "${nomeB}"`);
      }
    }
  }

  // 3) Candidatos repetidos DENTRO do mesmo local.
  const locaisComCand = await prisma.workplace.findMany({
    where: anoArg !== null ? { anoEleicao: anoArg } : undefined,
    select: {
      id: true,
      nome: true,
      anoEleicao: true,
      candidates: {
        select: { id: true, nome: true, _count: { select: { votes: true } } },
      },
    },
  });

  let totalCandDup = 0;
  const linhasCand: string[] = [];
  for (const l of locaisComCand) {
    const grupos = new Map<string, typeof l.candidates>();
    for (const c of l.candidates) {
      const chave = normalizar(c.nome);
      const arr = grupos.get(chave) ?? [];
      arr.push(c);
      grupos.set(chave, arr);
    }
    const repetidos = [...grupos.values()].filter((g) => g.length > 1);
    if (repetidos.length > 0) {
      linhasCand.push(`\n  ▸ Local "${l.nome}" (ano ${l.anoEleicao}, id=${l.id})`);
      for (const g of repetidos) {
        totalCandDup++;
        const comVoto = g.filter((c) => c._count.votes > 0).length;
        linhasCand.push(
          `      "${g[0].nome}" × ${g.length}` +
            (comVoto > 0 ? `  ⚠ ${comVoto} cópia(s) COM voto` : "  (sem votos)"),
        );
      }
    }
  }
  if (linhasCand.length > 0) {
    console.log(`\n${"─".repeat(64)}`);
    console.log(`CANDIDATOS REPETIDOS DENTRO DO MESMO LOCAL (${totalCandDup} grupo(s))`);
    console.log(linhasCand.join("\n"));
  }

  console.log(`\n${"═".repeat(64)}`);
  console.log("RESUMO");
  console.log(`  Grupos de locais com nome igual : ${totalGruposExatos}`);
  console.log(`  Pares de locais com nome similar: ${totalParesSimilares}`);
  console.log(`  Grupos de candidatos repetidos  : ${totalCandDup}`);
  console.log("═".repeat(64));
  if (totalGruposExatos + totalParesSimilares + totalCandDup === 0) {
    console.log("✔ Nenhum duplicado encontrado.");
  } else {
    console.log("Nada foi alterado (script somente leitura).");
  }
}

main()
  .catch((e) => {
    console.error("Erro no diagnóstico:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
