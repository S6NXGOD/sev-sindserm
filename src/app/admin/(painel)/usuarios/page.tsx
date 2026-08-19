import { Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/current-user";
import { formatDateTime } from "@/lib/format";
import { normalizarPermissoes } from "@/lib/permissions";
import {
  UsersManager,
  type UserRow,
} from "@/components/admin/users-manager";

export const dynamic = "force-dynamic";

/** Gestão de usuários — SOMENTE Administrador Geral (usuarios = EDIT). */
export default async function UsuariosPage() {
  const me = await requireModule("usuarios", "EDIT");

  const users = await prisma.user.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      username: true,
      permissoes: true,
      fotoUrl: true,
      ativo: true,
      createdAt: true,
    },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    nome: u.nome,
    username: u.username,
    permissoes: normalizarPermissoes(u.permissoes),
    fotoUrl: u.fotoUrl,
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
