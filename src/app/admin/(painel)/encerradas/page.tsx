import Link from "next/link";
import {
  Award,
  Building2,
  CheckCircle2,
  ExternalLink,
  Printer,
  Vote,
} from "lucide-react";
import { getReportData } from "@/lib/reports";
import {
  getCurrentElectionYear,
  getSelectedElectionYear,
  requirePleito,
} from "@/lib/election";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApuracoesList } from "@/components/admin/apuracoes-list";
import { ExportEleitosButton } from "@/components/admin/export-eleitos-button";

export const dynamic = "force-dynamic";

/** KPI compacto (mesma pegada dos cards da dashboard). */
function Kpi({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "green" | "blue";
}) {
  const cls = {
    default: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-sky-50 text-sky-600",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2.5 ${cls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">
            {value.toLocaleString("pt-BR")}
          </p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ÁREA RÁPIDA — Encerradas & Eleitos. Um só lugar para ver as votações
 * CONCLUÍDAS, os eleitos de cada local e ir direto aos relatórios/exportações.
 * Reaproveita getReportData({ somenteEncerradas }) e a ApuracoesList (busca +
 * cards de apuração já prontos).
 */
export default async function EncerradasPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();

  const data = await getReportData({ anoEleicao: ano, somenteEncerradas: true });

  const totalEleitos = data.apuracoes.reduce(
    (s, a) => s + a.eleitos.length,
    0,
  );
  const totalVotos = data.apuracoes.reduce((s, a) => s + a.totalVotos, 0);

  // Opções de filtro derivadas do que REALMENTE existe entre as encerradas.
  const orgaos = [...new Set(data.apuracoes.map((a) => a.orgao))].sort((x, y) =>
    x.localeCompare(y),
  );
  const zonas = [...new Set(data.apuracoes.map((a) => a.zona))].sort((x, y) =>
    x.localeCompare(y),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Encerradas &amp; Eleitos
        </h1>
        <p className="text-sm text-muted-foreground">
          Votações concluídas da eleição {ano}
          {ano !== anoVigente ? " (histórico — auditoria)" : ""} — eleitos por
          local e atalhos para os relatórios.
        </p>
      </div>

      {/* KPIs: 3 colunas já no mobile (números curtos). */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Kpi
          label="Locais encerrados"
          value={data.apuracoes.length}
          icon={CheckCircle2}
          tone="green"
        />
        <Kpi label="Eleitos" value={totalEleitos} icon={Award} tone="blue" />
        <Kpi label="Votos apurados" value={totalVotos} icon={Vote} />
      </div>

      {/* Ações rápidas — empilham no mobile, viram linha no desktop. */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/relatorios?tipo=encerradas">
              <Printer className="mr-2 h-4 w-4" />
              Relatório completo (imprimir / PDF)
            </Link>
          </Button>
          <ExportEleitosButton ano={ano} />
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/admin/locais?status=closed">
              <Building2 className="mr-2 h-4 w-4" />
              Locais encerrados
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/transparencia" target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Portal público
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Lista de apurações encerradas (busca + cards com eleitos/ranking). */}
      {data.apuracoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Nenhuma votação encerrada ainda. Assim que um local for encerrado,
              os eleitos aparecem aqui.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link href="/admin/locais">Ver locais de trabalho</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ApuracoesList
          apuracoes={data.apuracoes}
          orgaos={orgaos}
          zonas={zonas}
          defaultSort="fim_desc"
          showControls
        />
      )}
    </div>
  );
}
