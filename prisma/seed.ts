/**
 * Seed do SEV SINDSERM — cria o primeiro USUÁRIO (Administrador Geral).
 *
 * Com a gestão de usuários, o acesso deixou de ser uma senha única e passou a
 * ser por usuário (login + senha + papel). Este seed garante que exista ao menos
 * UM Administrador Geral para dar o bootstrap:
 *
 *  - Reaproveita o HASH da senha antiga do admin (Setting `admin_password_hash`,
 *    mesmo formato scrypt de src/lib/password.ts) → a senha que já era usada
 *    continua valendo, agora no login "admin".
 *  - Se não houver senha antiga, usa a senha de fábrica (troque no 1º acesso).
 *
 * IDEMPOTENTE: se já existir qualquer usuário, não faz nada. Executado por
 * `prisma db seed` (config em package.json → "prisma.seed"), inclusive no deploy.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const ADMIN_PASSWORD_KEY = "admin_password_hash";
const DEFAULT_ADMIN_PASSWORD = "Sindserm@2026";

// Administrador Geral do bootstrap: acesso total a todos os módulos.
const PERMISSOES_TOTAL = {
  dashboard: "EDIT",
  locais: "EDIT",
  encerradas: "EDIT",
  votantes: "EDIT",
  relatorios: "EDIT",
  pleitos: "EDIT",
  auditoria: "EDIT",
  usuarios: "EDIT",
  configuracoes: "EDIT",
} as const;

async function main() {
  const jaTemUsuario = await prisma.user.count();
  if (jaTemUsuario > 0) {
    console.log("✔ Já existem usuários — seed ignorado (idempotente).");
    return;
  }

  // Mesmo formato de hash (scrypt): dá para reusar o hash antigo diretamente.
  const antigo = await prisma.setting.findUnique({
    where: { key: ADMIN_PASSWORD_KEY },
  });
  const passwordHash = antigo?.value ?? (await hashPassword(DEFAULT_ADMIN_PASSWORD));

  await prisma.user.create({
    data: {
      username: "admin",
      nome: "Administrador Geral",
      passwordHash,
      role: "SUPER_ADMIN",
      permissoes: PERMISSOES_TOTAL,
      // Se reusou o hash antigo (senha real em uso), não força troca; se usou a
      // senha de fábrica, obriga a trocar no 1º acesso.
      mustChangePassword: !antigo,
    },
  });

  console.log("✔ Administrador Geral criado — login: 'admin'.");
  if (antigo) {
    console.log("  Senha: a MESMA que já era usada no painel.");
  } else {
    console.log(`  Senha inicial: ${DEFAULT_ADMIN_PASSWORD}`);
    console.log("  IMPORTANTE: troque no primeiro acesso (Configurações).");
  }
}

main()
  .catch((e) => {
    console.error("Erro ao executar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
