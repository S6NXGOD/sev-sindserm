/**
 * Massa de dados de DEMONSTRAÇÃO (somente desenvolvimento).
 *
 * ⚠️ DESTRUTIVO: apaga votos, votantes, candidatos e locais antes de recriar.
 * NUNCA execute em produção. Rode com `npm run db:seed:demo`.
 */
import { PrismaClient, Zona } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  // Limpa dados anteriores (ordem importa por causa das FKs)
  await prisma.vote.deleteMany();
  await prisma.voter.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.workplace.deleteMany();

  const agora = new Date();
  const inicio = new Date(agora.getTime() - 1000 * 60 * 60); // 1h atrás
  const fim = new Date(agora.getTime() + 1000 * 60 * 60 * 24 * 7); // +7 dias

  const escola = await prisma.workplace.create({
    data: {
      nome: "Escola Municipal Dom Barreto",
      zona: Zona.SUL,
      orgao: "SEMEC – Secretaria Municipal de Educação",
      linkToken: slugify("Escola Municipal Dom Barreto"),
      anoEleicao: 2026,
      dataInicioVotacao: inicio,
      dataFimVotacao: fim,
      candidates: {
        create: [
          { nome: "Maria da Silva" },
          { nome: "João Pereira" },
          { nome: "Ana Souza" },
        ],
      },
    },
  });

  const ubs = await prisma.workplace.create({
    data: {
      nome: "UBS Parque Piauí",
      zona: Zona.CENTRO,
      orgao: "FMS – Fundação Municipal de Saúde",
      linkToken: slugify("UBS Parque Piauí"),
      anoEleicao: 2026,
      dataInicioVotacao: inicio,
      dataFimVotacao: fim,
      candidates: {
        create: [{ nome: "Carlos Mendes" }, { nome: "Beatriz Lima" }],
      },
    },
  });

  console.log("Seed de demonstração concluído.");
  console.log(`Local 1: ${escola.nome} -> /votacao/${escola.linkToken}`);
  console.log(`Local 2: ${ubs.nome} -> /votacao/${ubs.linkToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
