import { ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/current-user";
import { formatDateTime } from "@/lib/format";
import {
  AuditoriaList,
  type AuditRow,
} from "@/components/admin/auditoria-list";

export const dynamic = "force-dynamic";

const LIMITE = 500; // últimos N registros (o suficiente para consulta rápida).

/** Auditoria — quem fez o quê. Requer a capacidade "auditoria". */
export default async function AuditoriaPage() {
  await requireCapability("auditoria");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: LIMITE,
    select: {
      id: true,
      createdAt: true,
      userNome: true,
      acao: true,
      alvo: true,
      detalhe: true,
    },
  });

  const rows: AuditRow[] = logs.map((l) => ({
    id: l.id,
    quando: formatDateTime(l.createdAt),
    userNome: l.userNome,
    acao: l.acao,
    alvo: l.alvo,
    detalhe: l.detalhe,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScrollText className="h-6 w-6 text-primary" />
          Auditoria
        </h1>
        <p className="text-sm text-muted-foreground">
          Registro de quem fez o quê no sistema (últimos {LIMITE} eventos). Ajuda
          a controlar quem abriu/encerrou eleições e alimentou os dados.
        </p>
      </div>

      <AuditoriaList rows={rows} />
    </div>
  );
}
