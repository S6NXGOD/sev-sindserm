"use client";

import { useState } from "react";
import {
  Award,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Loader2,
  Lock,
  MapPin,
  Repeat,
  Scale,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchResultadoLocal } from "@/lib/actions/transparencia";
import { downloadResultadoPdf, type PdfPleito } from "@/lib/transparencia-pdf";
import type {
  CandidatoResultado,
  ResultadoLocal,
  TransparenciaLocal,
} from "@/lib/transparencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinhaTempoLocal } from "@/components/transparencia/linha-tempo-local";

const PAGE = 15; // paginação interna por lista (anti-quebra no celular).

/** Data/hora curta em pt-BR (fuso de Brasília). */
function fmtData(iso: string | null): string {
  if (!iso) return "a definir";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return "a definir";
  }
}

const STATUS = {
  open: { label: "Em andamento", cls: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Encerrada", cls: "bg-slate-200 text-slate-700" },
  upcoming: { label: "Não iniciada", cls: "bg-amber-100 text-amber-700" },
  // Votação ainda não agendada pela diretoria (local sem janela).
  undefined: {
    label: "Aguardando agendamento",
    cls: "bg-slate-100 text-slate-600",
  },
} as const;

function ListaCandidatos({
  itens,
  tipo,
  parcial = false,
  shown,
  onMore,
  startPos = 1,
}: {
  itens: CandidatoResultado[];
  tipo: "eleito" | "suplente";
  /** true = números parciais (votação aberta): rótulos "Liderando"/"Logo atrás". */
  parcial?: boolean;
  shown: number;
  onMore: () => void;
  /** Posição inicial no ranking GERAL (suplentes continuam após eleitos+empate,
      em vez de reiniciar em 1º — que dava a impressão errada de novo "1º"). */
  startPos?: number;
}) {
  const visiveis = itens.slice(0, shown);
  const eleito = tipo === "eleito";
  const rotulo = eleito
    ? parcial
      ? "Liderando"
      : "Eleito"
    : parcial
      ? "Logo atrás"
      : "Suplente";
  return (
    <ol className="space-y-1.5">
      {visiveis.map((c, i) => {
        // Preservado = eleito numa rodada anterior (não concorreu na suplementar).
        const preservado = eleito && c.preservado;
        return (
          <li
            key={`${c.nome}-${i}`}
            className="flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">
                {startPos + i}º
              </span>
              <span className="truncate font-medium">{c.nome}</span>
              <Badge
                className={
                  eleito
                    ? preservado
                      ? "shrink-0 gap-1 bg-violet-600 hover:bg-violet-600"
                      : "shrink-0 gap-1 bg-emerald-600 hover:bg-emerald-600"
                    : "shrink-0 bg-slate-400 hover:bg-slate-400"
                }
              >
                {preservado ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  eleito && <Award className="h-3 w-3" />
                )}
                {preservado ? "Eleito (rodada anterior)" : rotulo}
              </Badge>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {c.votos} {c.votos === 1 ? "voto" : "votos"}
            </span>
          </li>
        );
      })}
      {shown < itens.length && (
        <li>
          <Button variant="ghost" size="sm" className="w-full" onClick={onMore}>
            <ChevronDown className="mr-1 h-4 w-4" />
            Ver mais {eleito ? "eleitos" : "suplentes"} (+
            {itens.length - shown})
          </Button>
        </li>
      )}
    </ol>
  );
}

export function LocalCard({
  local,
  pleito,
  parciaisPublicas = false,
}: {
  local: TransparenciaLocal;
  pleito: PdfPleito;
  parciaisPublicas?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLocal | null>(null);
  const [eleitosShown, setEleitosShown] = useState(PAGE);
  const [suplentesShown, setSuplentesShown] = useState(PAGE);

  const st = STATUS[local.status];
  const isClosed = local.status === "closed";
  const isOpen = local.status === "open";
  // Pode revelar a apuração por candidato? Encerrado (final) OU aberto COM
  // parciais públicas habilitadas (parcial ao vivo). O servidor também barra.
  const podeVerApuracao = isClosed || (isOpen && parciaisPublicas);

  async function garantirResultado(): Promise<ResultadoLocal | null> {
    if (resultado) return resultado;
    setLoading(true);
    try {
      const r = await fetchResultadoLocal(local.id);
      setResultado(r);
      return r;
    } finally {
      setLoading(false);
    }
  }

  // Abrir o modal: carrega o resultado sob demanda (só quando revelável).
  function handleOpen(o: boolean) {
    setOpen(o);
    if (o && podeVerApuracao && !resultado) void garantirResultado();
  }

  async function baixarPdf() {
    setPdfLoading(true);
    try {
      const r = await garantirResultado();
      if (r) await downloadResultadoPdf(r, pleito);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <div className="sev-hover-lift overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Cabeçalho do card (resumo) */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">{local.nome}</h3>
            <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {local.orgao} · Zona {local.zona}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}
            >
              {st.label}
            </span>
            {local.rodadaAtual > 1 && (
              <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                <Repeat className="h-3 w-3" />
                Suplementar · {local.rodadaAtual}ª rodada
              </span>
            )}
            {local.temEmpate && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                <Scale className="h-3 w-3" />
                Empate a resolver
              </span>
            )}
            {local.semRepresentacao && (
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                Sem representação
              </span>
            )}
          </div>
        </div>

        {/* Janela de votação: quando abre/encerra. Essencial p/ suplementar
            agendada (o filiado precisa saber o novo período). */}
        {(local.status === "upcoming" || local.status === "open") &&
          local.dataFim && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              {local.status === "upcoming"
                ? `Abre ${fmtData(local.dataInicio)} · encerra ${fmtData(local.dataFim)}`
                : `Votação encerra ${fmtData(local.dataFim)}`}
            </p>
          )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              <strong>{local.totalVotantes}</strong> votantes
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <Award className="h-4 w-4 text-muted-foreground" />
            <span>
              <strong>{local.vagas}</strong> {local.vagas === 1 ? "vaga" : "vagas"}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Eye className="mr-2 h-4 w-4" />
              {isClosed
                ? "Ver eleitos e suplentes"
                : isOpen && parciaisPublicas
                  ? "Ver parcial ao vivo"
                  : "Detalhes"}
            </Button>
          </DialogTrigger>
          {isClosed && (
            <Button size="sm" onClick={baixarPdf} disabled={pdfLoading}>
              {pdfLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              PDF
            </Button>
          )}
        </div>
      </div>
      </div>

      {/* Detalhe em MODAL: focado, sem bagunçar a grade. Resultado e linha do
          tempo lado a lado no desktop; empilham no mobile. */}
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 text-left">
            {local.nome}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}
            >
              {st.label}
            </span>
            {local.rodadaAtual > 1 && (
              <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                <Repeat className="h-3 w-3" />
                {local.rodadaAtual}ª rodada
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-left">
            {local.orgao} · Zona {local.zona} · {local.totalVotantes} votantes ·{" "}
            {local.vagas} {local.vagas === 1 ? "vaga" : "vagas"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <div className="min-w-0">
          {!podeVerApuracao ? (
            <p className="text-sm text-muted-foreground">
              {local.status === "open"
                ? "Votação em andamento. Os eleitos e suplentes ficam disponíveis quando a votação encerrar."
                : local.status === "upcoming"
                  ? "Votação ainda não iniciada."
                  : "Votação ainda não agendada."}
            </p>
          ) : loading || !resultado ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </p>
          ) : resultado.eleitos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {resultado.parcial
                ? "Votação em andamento — ainda sem votos computados."
                : "Votação encerrada sem votos registrados."}
            </p>
          ) : (
            <div className="space-y-4">
              {/* Aviso claro quando são números PARCIAIS de votação aberta. */}
              {resultado.parcial && (
                <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  <span className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
                  <span>
                    PARCIAL · votação em andamento — os números mudam a cada voto
                    e o resultado só é oficial quando encerrar.
                  </span>
                </p>
              )}
              {/* Rodada suplementar: deixa claro que há eleitos preservados. */}
              {resultado.rodadaAtual > 1 && (
                <p className="flex items-start gap-2 rounded-md border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-800">
                  <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {resultado.rodadaAtual}ª rodada (eleição suplementar). Os
                    eleitos das rodadas anteriores estão preservados e marcados
                    como “Eleito (rodada anterior)”.
                  </span>
                </p>
              )}
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {resultado.totalCandidatos} candidatos ·{" "}
                  {resultado.totalVotantes} votantes · {resultado.vagas}{" "}
                  {resultado.vagas === 1 ? "vaga" : "vagas"}
                </p>
              </div>

              {/* Reconciliação DESTA rodada: o filiado confere a "sua" urna. */}
              <div
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                  resultado.reconciliacao.confere
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {resultado.reconciliacao.confere ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  <strong>{resultado.reconciliacao.votantes}</strong> votante(s) e{" "}
                  <strong>{resultado.reconciliacao.votos}</strong> voto(s)
                  {resultado.rodadaAtual > 1 ? " nesta rodada" : ""} —{" "}
                  {resultado.reconciliacao.confere
                    ? "os números conferem."
                    : "há divergência; verifique."}
                </span>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-emerald-700">
                  {resultado.parcial
                    ? "Liderando agora (parcial)"
                    : "Eleitos (Titulares)"}
                </p>
                <ListaCandidatos
                  itens={resultado.eleitos}
                  tipo="eleito"
                  parcial={resultado.parcial}
                  shown={eleitosShown}
                  onMore={() => setEleitosShown((n) => n + PAGE)}
                />
              </div>

              {/* EMPATE na linha de corte — transparência do que falta decidir. */}
              {resultado.empate && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                    <Scale className="h-4 w-4" />
                    Empate na linha de corte
                    {resultado.parcial ? " (parcial)" : " — aguardando desempate"}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800">
                    {resultado.empate.candidatos.length} candidato(s) empatados com{" "}
                    <strong>{resultado.empate.votos}</strong> voto(s), disputando{" "}
                    <strong>{resultado.empate.vagasEmDisputa}</strong>{" "}
                    {resultado.empate.vagasEmDisputa === 1 ? "vaga" : "vagas"}.
                    {resultado.parcial
                      ? " Pode mudar até o encerramento."
                      : " O desempate segue deliberação da Diretoria Colegiada (Art. 24 do Regimento), registrada em ata."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {resultado.empate.candidatos.map((n) => (
                      <span
                        key={n}
                        className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-800"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {resultado.suplentes.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-600">
                    {resultado.parcial ? "Logo atrás" : "Suplentes"}
                  </p>
                  <ListaCandidatos
                    itens={resultado.suplentes}
                    tipo="suplente"
                    parcial={resultado.parcial}
                    shown={suplentesShown}
                    onMore={() => setSuplentesShown((n) => n + PAGE)}
                    // Continua o ranking geral: após os eleitos + os empatados na
                    // linha de corte (que ficam na caixa de empate, sem número).
                    startPos={
                      resultado.eleitos.length +
                      (resultado.empate?.candidatos.length ?? 0) +
                      1
                    }
                  />
                </div>
              )}

              {resultado.renunciantes.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-500">
                    Não assumiram a vaga
                  </p>
                  <ul className="space-y-1.5">
                    {resultado.renunciantes.map((c, i) => (
                      <li
                        key={`${c.nome}-${i}`}
                        className="rounded-md border bg-slate-50 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-muted-foreground line-through">
                            {c.nome}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {c.votos} {c.votos === 1 ? "voto" : "votos"}
                          </span>
                        </div>
                        {c.motivo && (
                          <span className="mt-1 inline-block rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {c.motivo}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A vaga foi promovida ao próximo suplente.
                  </p>
                </div>
              )}

              {resultado.semVotos > 0 && (
                <p className="text-xs text-muted-foreground">
                  + {resultado.semVotos} candidato(s) sem votos.
                </p>
              )}
            </div>
          )}
            </div>

            {/* Linha do tempo pública — 2ª coluna no desktop; cada passo do
                sindicato + histórico por rodada. Sempre disponível ao expandir. */}
            <div className="min-w-0">
              <LinhaTempoLocal
                workplaceId={local.id}
                orgao={local.orgao}
                zona={local.zona}
                pleito={pleito}
              />
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
