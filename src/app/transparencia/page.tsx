import { Activity, Award, CheckCircle2, ShieldCheck, Users, Vote } from "lucide-react";
import {
  getPleitosPublicos,
  getTransparenciaData,
} from "@/lib/transparencia";
import { ProximasAberturas } from "@/components/proximas-aberturas";
import { ParticipacaoPanel } from "@/components/transparencia/participacao-panel";
import { PleitoSelector } from "@/components/transparencia/pleito-selector";
import { FiltrosBar } from "@/components/transparencia/filtros-bar";
import { BuscaUrnaFloat } from "@/components/transparencia/busca-urna-float";
import { LocaisGrid } from "@/components/transparencia/locais-grid";
import { ExportButtons } from "@/components/transparencia/export-csv-button";
import { NovoResultadoSom } from "@/components/transparencia/novo-resultado-som";

export const dynamic = "force-dynamic";

type SP = { pleito?: string; q?: string; orgao?: string; status?: string };

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
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className={`shrink-0 rounded-lg p-2.5 ${cls}`}>
        <Icon className="h-5 w-5" />
      </div>
      {/* min-w-0 evita que o número longo estoure; o rótulo pode quebrar em 2
          linhas (sem truncar) para não cortar "Locais de votação" etc. */}
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none">
          {value.toLocaleString("pt-BR")}
        </p>
        <p className="mt-1 text-xs leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default async function TransparenciaPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const { pleitos, defaultId } = await getPleitosPublicos();

  if (!defaultId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/logo_default.png"
            alt="SEV SINDSERM"
            className="mx-auto h-20 w-20 object-contain"
          />
          <h1 className="mt-3 text-xl font-bold">Portal da Transparência</h1>
          <p className="mt-2 text-muted-foreground">
            Nenhuma eleição cadastrada ainda. Volte em breve.
          </p>
        </div>
      </main>
    );
  }

  const pleitoId =
    searchParams.pleito && pleitos.some((p) => p.id === searchParams.pleito)
      ? searchParams.pleito
      : defaultId;

  const data = await getTransparenciaData(pleitoId, {
    q: searchParams.q,
    orgao: searchParams.orgao,
    status:
      searchParams.status === "open" || searchParams.status === "closed"
        ? searchParams.status
        : "todos",
  });
  const pleito = data.pleito!;
  const pdfPleito = {
    titulo: pleito.titulo,
    trienio: pleito.trienio,
    logoSindserm: pleito.logoSindserm,
    logoPleito: pleito.logoPleito,
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Cabeçalho oficial com as logos do pleito */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pleito.logoSindserm}
            alt="SINDSERM"
            className="h-12 w-auto max-w-[160px] object-contain"
          />
          <div className="flex-1 text-center">
            <p className="flex items-center justify-center gap-1.5 text-lg font-bold tracking-tight">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Portal da Transparência
            </p>
            <p className="text-xs text-muted-foreground">SEV SINDSERM</p>
          </div>
          {pleito.logoPleito ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pleito.logoPleito}
              alt="Pleito"
              className="h-12 w-12 object-contain"
            />
          ) : (
            <span className="h-12 w-12" aria-hidden />
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Título do pleito selecionado (a logo já aparece no cabeçalho — evita
            redundância). */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {pleito.titulo}
          </h1>
          <p className="text-sm text-muted-foreground">
            Triênio {pleito.trienio}
            {pleito.isEspecial ? " · Especial" : ""} · Dados públicos e
            auditáveis · sem login.
          </p>
        </div>

        {/* Seletor de eleição em DESTAQUE — a primeira decisão do filiado. */}
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <PleitoSelector pleitos={pleitos} selected={pleitoId} />
            </div>
            <ExportButtons electionId={pleitoId} pleito={pdfPleito} />
          </div>
        </div>

        {/* KPIs (linha cheia, responsiva) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Locais de votação" value={data.kpis.locais} icon={Vote} tone="blue" />
          <Kpi label="Total de votantes" value={data.kpis.votos} icon={Users} />
          <Kpi label="Eleitos definidos" value={data.kpis.eleitos} icon={Award} tone="green" />
          <Kpi label="Vagas no pleito" value={data.kpis.vagas} icon={CheckCircle2} />
          <Kpi label="Em andamento" value={data.kpis.abertas} icon={Activity} tone="amber" />
          <Kpi label="Encerradas" value={data.kpis.encerradas} icon={CheckCircle2} tone="green" />
        </div>

        {/* Ranking & Participação (substitui o antigo gráfico de pizza) */}
        <ParticipacaoPanel
          ranking={data.rankingParticipacao}
          porZona={data.votantesPorZona}
          totalVotantes={data.kpis.votos}
          eleitos={data.kpis.eleitos}
          vagas={data.kpis.vagas}
        />

        {/* Próximas aberturas: o filiado vê quais urnas vão abrir e quando. */}
        <ProximasAberturas
          itens={data.proximasAberturas}
          total={data.kpis.agendadas}
          titulo="Próximas votações"
          descricao="Locais com votação já agendada — veja quando a sua urna abre."
          vazioTexto="Nenhuma votação agendada no momento. Acompanhe por aqui."
        />

        {/* Filtros */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <FiltrosBar orgaos={data.orgaos} />
        </div>

        {/* Resultados (cards) */}
        <LocaisGrid locais={data.locais} pleito={pdfPleito} />

        <footer className="border-t pt-6 text-center text-xs text-muted-foreground">
          Portal da Transparência do SEV SINDSERM · Sistema Eletrônico de Votação.
          {pleito.emailOficial && (
            <>
              {" "}
              Dúvidas ou envio de atas:{" "}
              <a href={`mailto:${pleito.emailOficial}`} className="underline">
                {pleito.emailOficial}
              </a>
              .
            </>
          )}
        </footer>
      </div>

      {/* Widget flutuante "Não sabe onde vota?" — ajuda o filiado a achar a urna
          sem ocupar um bloco fixo na página. */}
      <BuscaUrnaFloat electionId={pleitoId} />

      {/* "Ao vivo": auto-refresh + som de sucesso a cada novo resultado. */}
      <NovoResultadoSom encerradas={data.kpis.encerradas} autoRefreshMs={45000} />
    </main>
  );
}
