/**
 * Seed do SEV SINDSERM — credencial de administrador inicial.
 *
 * Este sistema NÃO possui tabela de usuários: o acesso ao painel é uma senha de
 * administrador única. Em produção, essa senha fica guardada com HASH (scrypt)
 * na tabela `Setting` (key = "admin_password_hash") — exatamente a MESMA função
 * de hash usada na autenticação (src/lib/password.ts). Enquanto não houver hash
 * no banco, o login aceita a variável de ambiente ADMIN_PASSWORD (fallback de
 * bootstrap); assim que existir, o banco prevalece.
 *
 * IDEMPOTENTE e SEGURO PARA PRODUÇÃO: se já houver credencial configurada, não
 * altera nada; nunca apaga dados. (A massa de dados de demonstração para
 * desenvolvimento fica em `prisma/seed-demo.ts` → `npm run db:seed:demo`.)
 *
 * Executado por `prisma db seed` (config em package.json → "prisma.seed").
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

// DEVE corresponder a ADMIN_PASSWORD_KEY em src/lib/actions/auth.ts.
const ADMIN_PASSWORD_KEY = "admin_password_hash";
const DEFAULT_ADMIN_PASSWORD = "Sindserm@2026";

async function main() {
  const existente = await prisma.setting.findUnique({
    where: { key: ADMIN_PASSWORD_KEY },
  });

  if (existente) {
    console.log(
      "✔ Credencial de administrador já existe — seed ignorado (idempotente).",
    );
    return;
  }

  // Mesma função de hash da autenticação (scrypt, formato salt:hash).
  const hash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  await prisma.setting.create({
    data: { key: ADMIN_PASSWORD_KEY, value: hash },
  });

  console.log("✔ Administrador padrão criado.");
  console.log(`  Senha inicial: ${DEFAULT_ADMIN_PASSWORD}`);
  console.log(
    "  IMPORTANTE: troque a senha no primeiro acesso (Configurações → Segurança).",
  );
}

main()
  .catch((e) => {
    console.error("Erro ao executar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
