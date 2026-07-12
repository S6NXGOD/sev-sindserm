"use client";

import { useState } from "react";
import {
  Award,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";
import { fetchResultadoLocal } from "@/lib/actions/transparencia";
import { downloadResultadoPdf, type PdfPleito } from "@/lib/transparencia-pdf";
import type {
  CandidatoResultado,
  ResultadoLocal,
  TransparenciaLocal,
} from "@/lib/transparencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE = 15; // paginação interna por lista (anti-quebra no celular).

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
  shown,
  onMore,
}: {
  itens: CandidatoResultado[];
  tipo: "eleito" | "suplente";
  shown: number;
  onMore: () => void;
}) {
  const visiveis = itens.slice(0, shown);
  const eleito = tipo === "eleito";
  return (
    <ol className="space-y-1.5">
      {visiveis.map((c, i) => (
        <li
          key={`${c.nome}-${i}`}
          className="flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">
              {i + 1}º
            </span>
            <span className="truncate font-medium">{c.nome}</span>
            <Badge
              className={
                eleito
                  ? "shrink-0 gap-1 bg-emerald-600 hover:bg-emerald-600"
                  : "shrink-0 bg-slate-400 hover:bg-slate-400"
              }
            >
              {eleito && <Award className="h-3 w-3" />}
              {eleito ? "Eleito" : "Suplente"}
            </Badge>
          </span>
          <span className="shrink-0 font-semibold tabular-nums">
            {c.votos} {c.votos === 1 ? "voto" : "votos"}
          </span>
        </li>
      ))}
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
}: {
  local: TransparenciaLocal;
  pleito: PdfPleito;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLocal | null>(null);
  const [eleitosShown, setEleitosShown] = useState(PAGE);
  const [suplentesShown, setSuplentesShown] = useState(PAGE);

  const st = STATUS[local.status];
  const isClosed = local.status === "closed";

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

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && isClosed && !resultado) await garantirResultado();
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
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
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
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}
          >
            {st.label}
          </span>
        </div>

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
          <Button
            variant="outline"
            size="sm"
            onClick={toggle}
            className="flex-1"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : open ? (
              <ChevronUp className="mr-2 h-4 w-4" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4" />
            )}
            {open ? "Recolher" : isClosed ? "Ver eleitos e suplentes" : "Detalhes"}
          </Button>
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

      {/* Conteúdo expandido */}
      {open && (
        <div className="border-t bg-muted/30 p-4">
          {!isClosed ? (
            <p className="text-sm text-muted-foreground">
              {local.status === "open"
                ? "Votação em andamento. Os eleitos e suplentes ficam disponíveis quando a votação encerrar."
                : "Votação ainda não iniciada."}
            </p>
          ) : loading || !resultado ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando resultados…
            </p>
          ) : resultado.eleitos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Votação encerrada sem votos registrados.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {resultado.totalCandidatos} candidatos ·{" "}
                  {resultado.totalVotantes} votantes · {resultado.vagas}{" "}
                  {resultado.vagas === 1 ? "vaga" : "vagas"}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-emerald-700">
                  Eleitos (Titulares)
                </p>
                <ListaCandidatos
                  itens={resultado.eleitos}
                  tipo="eleito"
                  shown={eleitosShown}
                  onMore={() => setEleitosShown((n) => n + PAGE)}
                />
              </div>

              {resultado.suplentes.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-600">
                    Suplentes
                  </p>
                  <ListaCandidatos
                    itens={resultado.suplentes}
                    tipo="suplente"
                    shown={suplentesShown}
                    onMore={() => setSuplentesShown((n) => n + PAGE)}
                  />
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
      )}
    </div>
  );
}
