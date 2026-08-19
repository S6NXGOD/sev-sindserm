import { Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/current-user";
import { formatDateTime } from "@/lib/format";
import type { Role } from "@/lib/permissions";
import {
  UsersManager,
  type UserRow,
} from "@/components/admin/users-manager";

export const dynamic = "force-dynamic";

/** Gestão de usuários — SOMENTE Administrador Geral (capacidade "users"). */
export default async function UsuariosPage() {
  const me = await requireCapability("users");

  const users = await prisma.user.findMany({
    orderBy: [{ ativo: "desc" }, { role: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      username: true,
      role: true,
      ativo: true,
      createdAt: true,
    },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    nome: u.nome,
    username: u.username,
    role: u.role as Role,
    ativo: u.ativo,
    createdAt: formatDateTime(u.createdAt),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Shield className="h-6 w-6 text-primary" />
          Usuários
        </h1>
        <p className="text-sm text-muted-foreground">
          Cada pessoa acessa com login e senha próprios. O papel define o que ela
          pode fazer — e tudo fica registrado na Auditoria.
        </p>
      </div>

      <UsersManager users={rows} currentUserId={me.id} />
    </div>
  );
}
