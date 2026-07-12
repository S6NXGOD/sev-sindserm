/**
 * RESET DAS DATAS DOS LOCAIS — migração da nova regra de negócio.
 *
 * Zera (null) a janela de votação dos Locais de Trabalho do pleito, passando-os
 * para o status "Não definida" (Aguardando Diretoria). A diretoria visita o
 * local e só então agenda início/fim.
 *
 * EXCEÇÃO DE OURO: locais que JÁ possuem data de início no FUTURO não são
 * tocados — eles já foram agendados e devem permanecer "Não iniciadas".
 *
 * TRAVA DE SEGURANÇA: nunca zera a janela de um local que já tenha VOTO ou
 * VOTANTE (apagar a janela de uma urna que já votou corromperia a apuração).
 * Esses são pulados e reportados.
 *
 * DRY-RUN por padrão — só grava com --apply.
 *
 *   npx tsx prisma/reset-datas-locais.ts                 (dry-run, pleito vigente)
 *   npx tsx prisma/reset-datas-locais.ts 2026            (dry-run, ano informado)
 *   npx tsx prisma/reset-datas-locais.ts 2026 --apply    (EFETIVA)
 *
 * Atalho: npm run db:reset-datas
 */
import { PrismaClient } from "@prisma/client";
import { votingStatus } from "../src/lib/voting-status";

const prisma = new PrismaClient();

/** Host:porta/banco do DATABASE_URL, SEM credenciais — confere o alvo. */
function alvoBanco(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.host}${u.pathname}`;
  } catch {
    return "(DATABASE_URL ausente ou inválido)";
  }
}

function anoVigentePadrao(): number {
  const env = Number(process.env.NEXT_PUBLIC_CURRENT_ELECTION_YEAR);
  return Number.isInteger(env) ? env : new Date().getFullYear();
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const anoArg = args.find((a) => /^\d{4}$/.test(a));
  const ano = anoArg ? Number(anoArg) : anoVigentePadrao();
  const now = new Date();

  console.log("═".repeat(66));
  console.log(`RESET DAS DATAS DOS LOCAIS — pleito ${ano}`);
  console.log(`Banco alvo: ${alvoBanco()}`);
  console.log(`Modo: ${apply ? "APLICAR (vai gravar!)" : "DRY-RUN (só simula)"}`);
  console.log("═".repeat(66));

  const locais = await prisma.workplace.findMany({
    where: { anoEleicao: ano },
    select: {
      id: true,
      nome: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
      _count: { select: { votes: true, voters: true } },
    },
    orderBy: { nome: "asc" },
  });

  const paraZerar: string[] = [];
  let jaNulas = 0;
  let agendadas = 0; // exceção de ouro: início no futuro
  const comVotos: string[] = [];

  for (const l of locais) {
    const status = votingStatus(l.dataInicioVotacao, l.dataFimVotacao, now);

    if (status === "undefined") {
      jaNulas++;
      continue; // já está "Não definida" — nada a fazer
    }

    // EXCEÇÃO DE OURO: já agendada para o futuro → preserva.
    if (status === "upcoming") {
      agendadas++;
      console.log(`  ⏭  AGENDADA (mantém): "${l.nome}"`);
      continue;
    }

    // TRAVA: nunca zerar janela de urna que já recebeu voto/votante.
    if (l._count.votes > 0 || l._count.voters > 0) {
      comVotos.push(l.nome);
      console.log(
        `  ⚠  PULA (tem voto/votante): "${l.nome}" — votos=${l._count.votes} votantes=${l._count.voters}`,
      );
      continue;
    }

    paraZerar.push(l.id);
  }

  if (paraZerar.length > 0 && apply) {
    const res = await prisma.workplace.updateMany({
      where: { id: { in: paraZerar } },
      data: { dataInicioVotacao: null, dataFimVotacao: null },
    });
    console.log(`\n  ✔ ${res.count} local(is) zerado(s) → "Não definida".`);
  }

  console.log(`\n${"─".repeat(66)}`);
  console.log("RESUMO");
  console.log(`  Locais no pleito              : ${locais.length}`);
  console.log(`  Já estavam "Não definidas"    : ${jaNulas}`);
  console.log(`  Agendadas (mantidas, exceção) : ${agendadas}`);
  console.log(`  Puladas por ter voto/votante  : ${comVotos.length}`);
  console.log(
    `  ${apply ? "Zeradas agora" : "Seriam zeradas"}               : ${paraZerar.length}`,
  );
  console.log("═".repeat(66));
  if (!apply && paraZerar.length > 0) {
    console.log("DRY-RUN — rode de novo com --apply para efetivar.");
  }
}

main()
  .catch((e) => {
    console.error("Erro no reset das datas:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
