import Link from "next/link";
import {
  Award,
  Building2,
  CheckCircle2,
  ExternalLink,
  Scale,
  Vote,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getReportData } from "@/lib/reports";
import {
  getCurrentElectionYear,
  getElectionLogos,
  getSelectedElectionYear,
  requirePleito,
  tituloInstitucional,
} from "@/lib/election";
import { requireModule } from "@/lib/current-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApuracoesList } from "@/components/admin/apuracoes-list";
import { ApuracaoPdfButton } from "@/components/admin/apuracao-pdf-button";
import { EmpatesPanel } from "@/components/admin/empates-panel";
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
  tone?: "default" | "green" | "blue" | "amber";
}) {
  const cls = {
    default: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
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
          <p className="mt-1 text-xs leading-tight text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ÁREA RÁPIDA — Encerradas & Eleitos. Um só lugar para NAVEGAR as votações
 * concluídas, ver os eleitos, os EMPATES a resolver e baixar o documento.
 * Reaproveita getReportData({ somenteEncerradas }) e a ApuracoesList.
 */
export default async function EncerradasPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  await requireModule("encerradas", "VIEW");
  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();

  const [data, logos, pleito] = await Promise.all([
    getReportData({ anoEleicao: ano, somenteEncerradas: true }),
    getElectionLogos(ano),
    prisma.election.findFirst({
      where: { ano },
      orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
      select: { titulo: true, duracaoMandato: true },
    }),
  ]);

  const totalEleitos = data.apuracoes.reduce((s, a) => s + a.eleitos.length, 0);
  const totalVotos = data.apuracoes.reduce((s, a) => s + a.totalVotos, 0);
  const empates = data.apuracoes.filter((a) => a.temEmpate);
  const comVagaVazia = data.apuracoes.filter((a) => a.vagasVazias > 0);

  // Opções de filtro derivadas do que REALMENTE existe entre as encerradas.
  const orgaos = [...new Set(data.apuracoes.map((a) => a.orgao))].sort((x, y) =>
    x.localeCompare(y),
  );
  const zonas = [...new Set(data.apuracoes.map((a) => a.zona))].sort((x, y) =>
    x.localeCompare(y),
  );

  const pdfHeader = {
    logoSindserm: logos.sindserm,
    logoPleito: logos.pleito,
    tituloPleito: tituloInstitucional(pleito?.titulo, ano, pleito?.duracaoMandato ?? 3),
    subtitulo: "Relatório de Votações Encerradas",
    filtro: "Apenas votações encerradas",
    geradoEm: data.geradoEmDisplay,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Encerradas &amp; Eleitos
        </h1>
        <p className="text-sm text-muted-foreground">
          Votações concluídas da eleição {ano}
          {ano !== anoVigente ? " (histórico — auditoria)" : ""} — eleitos,
          empates a resolver e o documento oficial.
        </p>
      </div>

      {/* KPIs. "Empates" salta em âmbar quando há resultado travado. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Kpi
          label="Locais encerrados"
          value={data.apuracoes.length}
          icon={CheckCircle2}
          tone="green"
        />
        <Kpi label="Eleitos" value={totalEleitos} icon={Award} tone="blue" />
        <Kpi label="Votos apurados" value={totalVotos} icon={Vote} />
        <Kpi
          label="Empates a resolver"
          value={empates.length}
          icon={Scale}
          tone="amber"
        />
      </div>

      {/* EMPATES — no topo, para resolver rápido (só aparece se houver). */}
      <EmpatesPanel empates={empates} />

      {/* VAGAS SEM PREENCHIMENTO → sugestão de votação suplementar. */}
      {comVagaVazia.length > 0 && (
        <section className="rounded-xl border-2 border-amber-300 bg-amber-50 shadow-sm">
          <div className="flex items-center gap-2 border-b border-amber-200 p-4">
            <Scale className="h-5 w-5 shrink-0 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900">
              Vagas sem preenchimento
            </h2>
            <span className="rounded-full border border-amber-400 bg-white px-2 py-0.5 text-xs font-semibold text-amber-800">
              {comVagaVazia.length} local(is)
            </span>
          </div>
          <ul className="divide-y divide-amber-200">
            {comVagaVazia.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.orgao} · Zona {a.zona} · {a.vagasVazias} de {a.vagas}{" "}
                    {a.vagas === 1 ? "vaga" : "vagas"} sem eleito
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/locais/${a.id}`}>
                    Agendar suplementar
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
          <p className="border-t border-amber-200 p-3 text-xs text-amber-800">
            Faltam candidatos com votos para preencher todas as vagas. Considere
            uma <strong>votação suplementar</strong>: cadastre novos candidatos no
            local e reabra/reagende a votação.
          </p>
        </section>
      )}

      {/* Ações rápidas — o PDF agora é gerado direto aqui (jsPDF). */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          {data.apuracoes.length > 0 && (
            <ApuracaoPdfButton data={data} header={pdfHeader} />
          )}
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

      {/* Lista de apurações encerradas (busca + ordenação + cards). */}
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
