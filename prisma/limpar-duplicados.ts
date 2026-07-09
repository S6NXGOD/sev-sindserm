/**
 * LIMPEZA de duplicados EXATOS — locais e candidatos. Script PROVISÓRIO.
 *
 * DRY-RUN por padrão (não apaga nada; só mostra o que faria). Use --apply para
 * efetivar. Sempre rode o diagnóstico antes: `npx tsx prisma/verificar-duplicados.ts`.
 *
 *   npx tsx prisma/limpar-duplicados.ts                  (dry-run, todos os anos)
 *   npx tsx prisma/limpar-duplicados.ts 2026             (dry-run, só 2026)
 *   npx tsx prisma/limpar-duplicados.ts 2026 --apply     (EFETIVA em 2026)
 *   npx tsx prisma/limpar-duplicados.ts --apply --so=locais       (só locais)
 *   npx tsx prisma/limpar-duplicados.ts --apply --so=candidatos   (só candidatos)
 *
 * REGRAS (confirmadas com o cliente):
 *  • LOCAIS: só nomes EXATAMENTE iguais, dentro do mesmo ano de eleição. Nada de
 *    "similar". Mantém 1 e apaga as cópias vazias.
 *  • CANDIDATOS: só nomes EXATAMENTE iguais DENTRO do mesmo local. NUNCA compara
 *    candidatos entre locais diferentes (nomes iguais em locais distintos ficam).
 *  • SEGURANÇA DO VOTO (padrão mais protetor): NUNCA apaga uma cópia que tenha
 *    voto; e NUNCA apaga um local que tenha voto ou votante. Se o duplicado tiver
 *    voto/votante, ele é PULADO e reportado para conferência manual (o apagar de
 *    um local faz cascade em candidatos, votos e votantes — schema.prisma).
 *
 * "EXATAMENTE igual" = mesmo texto após aparar espaços das pontas e colapsar
 * espaços internos. Diferença de MAIÚSCULAS/minúsculas ou de ACENTOS NÃO conta
 * como igual (é exatidão literal, como pedido). Se quiser afrouxar, me avise.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Chave de igualdade EXATA: só apara/colapsa espaços (mantém caixa e acento). */
function chaveExata(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Host:porta/banco do DATABASE_URL, SEM usuário/senha — para conferir o alvo. */
function alvoBanco(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.host}${u.pathname}`;
  } catch {
    return "(DATABASE_URL ausente ou inválido)";
  }
}

type Escopo = "ambos" | "locais" | "candidatos";

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const anoStr = args.find((a) => /^\d{4}$/.test(a));
  const ano = anoStr ? Number(anoStr) : null;
  const soArg = args.find((a) => a.startsWith("--so="));
  const so = soArg?.slice("--so=".length);
  let escopo: Escopo = "ambos";
  if (so === "locais" || so === "candidatos") escopo = so;
  return { apply, ano, escopo };
}

/** LOCAIS com nome exatamente igual (mesmo ano). Remove cópias SEM voto/votante. */
async function limparLocais(ano: number | null, apply: boolean) {
  const locais = await prisma.workplace.findMany({
    where: ano !== null ? { anoEleicao: ano } : undefined,
    select: {
      id: true,
      nome: true,
      orgao: true,
      zona: true,
      anoEleicao: true,
      createdAt: true,
      _count: { select: { candidates: true, votes: true, voters: true } },
    },
  });

  const grupos = new Map<string, typeof locais>();
  for (const l of locais) {
    const chave = `${l.anoEleicao}::${chaveExata(l.nome)}`;
    const arr = grupos.get(chave) ?? [];
    arr.push(l);
    grupos.set(chave, arr);
  }
  const duplicados = [...grupos.values()].filter((g) => g.length > 1);

  console.log(`\n${"─".repeat(64)}`);
  console.log(`LOCAIS com nome EXATAMENTE igual: ${duplicados.length} grupo(s)`);

  const idsRemover: string[] = [];
  let pulados = 0;

  for (const g of duplicados) {
    const temAtividade = (l: (typeof g)[number]) =>
      l._count.votes > 0 || l._count.voters > 0;
    const ativos = g.filter(temAtividade);

    // Mais de um local do grupo com voto/votante → não dá para mesclar com
    // segurança. Pula o grupo inteiro para conferência manual.
    if (ativos.length > 1) {
      pulados++;
      console.log(
        `\n  ⚠ "${g[0].nome}" (ano ${g[0].anoEleicao}) — ${ativos.length} cópias COM voto/votante. PULADO (revisar à mão).`,
      );
      for (const l of g) {
        console.log(
          `      id=${l.id}  votos=${l._count.votes} votantes=${l._count.voters} cand=${l._count.candidates}`,
        );
      }
      continue;
    }

    // Sobrevivente: o que tem voto/votante (se houver); senão o com mais
    // candidatos; empate → o mais antigo.
    const manter =
      ativos.length === 1
        ? ativos[0]
        : [...g].sort(
            (a, b) =>
              b._count.candidates - a._count.candidates ||
              a.createdAt.getTime() - b.createdAt.getTime(),
          )[0];

    const remover = g.filter((l) => l.id !== manter.id);
    console.log(`\n  • "${g[0].nome}" (ano ${g[0].anoEleicao}) — ${g.length} cópias`);
    console.log(
      `      MANTÉM id=${manter.id} (votos=${manter._count.votes} votantes=${manter._count.voters} cand=${manter._count.candidates})`,
    );
    for (const l of remover) {
      // Guarda extra: jamais remover algo com voto/votante.
      if (temAtividade(l)) {
        pulados++;
        console.log(
          `      PULA  id=${l.id} — tem voto/votante (votos=${l._count.votes} votantes=${l._count.voters})`,
        );
        continue;
      }
      idsRemover.push(l.id);
      console.log(
        `      APAGA id=${l.id} (cand=${l._count.candidates}, sem voto/votante)`,
      );
    }
  }

  if (apply && idsRemover.length > 0) {
    const res = await prisma.workplace.deleteMany({
      where: { id: { in: idsRemover } },
    });
    console.log(`\n  ✔ ${res.count} local(is) apagado(s) (cascade nos candidatos).`);
  }
  return { remover: idsRemover.length, pulados };
}

/** CANDIDATOS com nome exatamente igual DENTRO do mesmo local. */
async function limparCandidatos(ano: number | null, apply: boolean) {
  const locais = await prisma.workplace.findMany({
    where: ano !== null ? { anoEleicao: ano } : undefined,
    select: {
      id: true,
      nome: true,
      anoEleicao: true,
      candidates: {
        select: { id: true, nome: true, createdAt: true, _count: { select: { votes: true } } },
      },
    },
  });

  console.log(`\n${"─".repeat(64)}`);
  console.log("CANDIDATOS com nome EXATAMENTE igual (dentro do mesmo local):");

  const idsRemover: string[] = [];
  let grupos = 0;
  let pulados = 0;

  for (const local of locais) {
    const porNome = new Map<string, typeof local.candidates>();
    for (const c of local.candidates) {
      const chave = chaveExata(c.nome);
      const arr = porNome.get(chave) ?? [];
      arr.push(c);
      porNome.set(chave, arr);
    }
    const repetidos = [...porNome.values()].filter((g) => g.length > 1);
    if (repetidos.length === 0) continue;

    console.log(`\n  ▸ Local "${local.nome}" (ano ${local.anoEleicao}, id=${local.id})`);
    for (const g of repetidos) {
      grupos++;
      const comVoto = g.filter((c) => c._count.votes > 0);

      // Mais de uma cópia com voto → não mexer (não foi autorizado somar votos).
      if (comVoto.length > 1) {
        pulados++;
        console.log(
          `      ⚠ "${g[0].nome}" × ${g.length} — ${comVoto.length} cópias COM voto. PULADO (revisar à mão).`,
        );
        continue;
      }

      const manter =
        comVoto.length === 1
          ? comVoto[0]
          : [...g].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      const remover = g.filter((c) => c.id !== manter.id);

      console.log(
        `      "${g[0].nome}" × ${g.length} → mantém id=${manter.id}, apaga ${remover.length}`,
      );
      for (const c of remover) {
        if (c._count.votes > 0) {
          pulados++;
          console.log(`          PULA id=${c.id} — tem ${c._count.votes} voto(s)`);
          continue;
        }
        idsRemover.push(c.id);
      }
    }
  }

  if (grupos === 0) console.log("  (nenhum)");

  if (apply && idsRemover.length > 0) {
    const res = await prisma.candidate.deleteMany({
      where: { id: { in: idsRemover } },
    });
    console.log(`\n  ✔ ${res.count} candidato(s) apagado(s).`);
  }
  return { remover: idsRemover.length, grupos, pulados };
}

async function main() {
  const { apply, ano, escopo } = parseArgs();

  console.log("═".repeat(64));
  console.log(
    `LIMPEZA DE DUPLICADOS EXATOS ${ano !== null ? `— ano ${ano}` : "— todos os anos"}`,
  );
  console.log(`Banco alvo: ${alvoBanco()}`);
  console.log(`Escopo: ${escopo}   Modo: ${apply ? "APLICAR (vai apagar!)" : "DRY-RUN (só simula)"}`);
  console.log("═".repeat(64));

  let locaisRem = 0;
  let candRem = 0;

  if (escopo === "ambos" || escopo === "locais") {
    const r = await limparLocais(ano, apply);
    locaisRem = r.remover;
  }
  if (escopo === "ambos" || escopo === "candidatos") {
    const r = await limparCandidatos(ano, apply);
    candRem = r.remover;
  }

  console.log(`\n${"═".repeat(64)}`);
  if (apply) {
    console.log(`FINALIZADO. Locais apagados: ${locaisRem} · Candidatos apagados: ${candRem}`);
  } else {
    console.log(
      `DRY-RUN. Apagaria ${locaisRem} local(is) e ${candRem} candidato(s). ` +
        `Rode de novo com --apply para efetivar.`,
    );
  }
  console.log("═".repeat(64));
}

main()
  .catch((e) => {
    console.error("Erro na limpeza:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
