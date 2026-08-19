/**
 * Correção pontual: nomes de LOCAIS que terminam com extensão de arquivo
 * (".csv", ".xlsx", ".txt"...), resíduo de importação. Remove o sufixo.
 *
 * DRY-RUN por padrão; --apply para gravar.
 *   npx tsx prisma/corrigir-nomes-arquivo.ts
 *   npx tsx prisma/corrigir-nomes-arquivo.ts --apply
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const EXT = /\s*\.(csv|xlsx?|txt|pdf)\s*$/i;

function alvoBanco(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.host}${u.pathname}`;
  } catch {
    return "(DATABASE_URL ausente)";
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log("═".repeat(60));
  console.log(`CORRIGIR NOMES COM EXTENSÃO DE ARQUIVO`);
  console.log(`Banco alvo: ${alvoBanco()}   Modo: ${apply ? "APLICAR" : "DRY-RUN"}`);
  console.log("═".repeat(60));

  const locais = await prisma.workplace.findMany({
    select: { id: true, nome: true },
  });
  const afetados = locais.filter((l) => EXT.test(l.nome));

  if (afetados.length === 0) {
    console.log("Nenhum nome com extensão de arquivo. Nada a corrigir.");
    return;
  }

  for (const l of afetados) {
    const novo = l.nome.replace(EXT, "").trimEnd();
    console.log(`  "${l.nome}"  →  "${novo}"`);
    if (apply) {
      await prisma.workplace.update({ where: { id: l.id }, data: { nome: novo } });
    }
  }

  console.log(
    `\n${apply ? "✔ Corrigidos" : "Seriam corrigidos"}: ${afetados.length} local(is).`,
  );
  if (!apply) console.log("Rode de novo com --apply para gravar.");
}

main()
  .catch((e) => {
    console.error("Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
