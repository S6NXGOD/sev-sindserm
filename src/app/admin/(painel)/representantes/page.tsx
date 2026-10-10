import {
  getCurrentElectionYear,
  getSelectedElectionYear,
  requirePleito,
} from "@/lib/election";
import { requireModule } from "@/lib/current-user";
import { pode } from "@/lib/permissions";
import { getRepresentantesData } from "@/lib/mandato";
import { RepresentantesManager } from "@/components/admin/representantes-manager";

export const dynamic = "force-dynamic";

/**
 * GESTÃO DE REPRESENTANTES (camada de mandato). Lê os mandatos materializados na
 * homologação + os locais aptos a homologar. Ver exige `encerradas` (VIEW);
 * AGIR (homologar, vacância, convocar, afastar, posse) exige `pleitos` (EDIT) —
 * `canManage` esconde as ações de quem não pode.
 */
export default async function RepresentantesPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  const user = await requireModule("encerradas", "VIEW");
  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();
  const data = await getRepresentantesData(ano);
  const canManage = pode(user.permissoes, "pleitos", "EDIT");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Representantes eleitos
        </h1>
        <p className="text-sm text-muted-foreground">
          Mandato {ano}
          {ano !== anoVigente ? " (histórico)" : ""} — titulares, suplência e a
          gestão do triênio: posse, licença, renúncia/vacância e convocação de
          suplente. A apuração original é preservada.
        </p>
      </div>
      <RepresentantesManager
        mandatos={data.mandatos}
        aptos={data.aptos}
        ano={ano}
        canManage={canManage}
      />
    </div>
  );
}
