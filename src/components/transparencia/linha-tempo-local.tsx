"use client";

import { useState } from "react";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  FilePlus2,
  Flag,
  Loader2,
  Lock,
  Repeat,
  RotateCcw,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { fetchLinhaTempoLocal } from "@/lib/actions/transparencia";
import type {
  LinhaTempoLocal as LinhaTempoData,
  RodadaArquivada,
  TimelineEvento,
} from "@/lib/transparencia";

const PAGE = 8;

// Ícone + cor por tipo de ato (humaniza a leitura da linha do tempo).
const ESTILO: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; cor: string; ring: string }
> = {
  CADASTRO: { Icon: FilePlus2, cor: "text-slate-500", ring: "bg-slate-100" },
  AGENDAMENTO: { Icon: CalendarClock, cor: "text-sky-600", ring: "bg-sky-100" },
  ENCERRAMENTO: { Icon: Flag, cor: "text-slate-700", ring: "bg-slate-200" },
  REABERTURA: { Icon: RotateCcw, cor: "text-amber-600", ring: "bg-amber-100" },
  SUPLEMENTAR: { Icon: Repeat, cor: "text-violet-600", ring: "bg-violet-100" },
  RENUNCIA: { Icon: UserX, cor: "text-rose-600", ring: "bg-rose-100" },
  RODADA_ENCERRADA: { Icon: Archive, cor: "text-emerald-700", ring: "bg-emerald-100" },
};

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function RodadaCard({ r }: { r: RodadaArquivada }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-xl border bg-white">
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Archive className="h-4 w-4 shrink-0 text-emerald-700" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {r.rodada}ª rodada — resultado arquivado
          </span>
          <span className="block text-xs text-muted-foreground">
            Encerrada em {fmt(r.encerradaEm)} · {r.eleitos.length} eleito(s)
          </span>
        </span>
        <span
          className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline-flex ${
            r.confere ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {r.confere ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <TriangleAlert className="h-3 w-3" />
          )}
          {r.votantes} = {r.votos}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>
      {aberto && (
        <div className="border-t px-3 py-2.5">
          <p className="mb-1.5 text-xs text-muted-foreground">
            {r.vagas} vaga(s) · {r.votantes} votante(s) ·{" "}
            {r.confere ? "urna conferida" : "verificar números"}
          </p>
          <ol className="space-y-1">
            {r.eleitos.map((e, i) => (
              <li
                key={`${e.nome}-${i}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">
                    {i + 1}º
                  </span>
                  <span className="truncate">{e.nome}</span>
                  {e.preservado && (
                    <Lock className="h-3 w-3 shrink-0 text-violet-500" />
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {e.votos} voto(s)
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Evento({ e, ultimo }: { e: TimelineEvento; ultimo: boolean }) {
  const st = ESTILO[e.tipo] ?? ESTILO.CADASTRO;
  return (
    <li className="relative flex gap-3 pb-4">
      {/* Linha vertical conectando os pontos. */}
      {!ultimo && (
        <span className="absolute left-[15px] top-8 h-full w-px bg-slate-200" aria-hidden />
      )}
      <span
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${st.ring}`}
      >
        <st.Icon className={`h-4 w-4 ${st.cor}`} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold leading-tight">{e.titulo}</p>
        {e.detalhe && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {e.detalhe}
          </p>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {fmt(e.data)}
          </span>
          {e.autorNome && <span>· {e.autorNome}</span>}
          {e.rodada > 1 && (
            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700">
              {e.rodada}ª rodada
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

/**
 * "Linha do tempo e histórico" de um local — cada passo oficial do sindicato +
 * o resultado arquivado de cada rodada. Lazy-load: só busca ao abrir. Público.
 */
export function LinhaTempoLocal({ workplaceId }: { workplaceId: string }) {
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LinhaTempoData | null>(null);
  const [shown, setShown] = useState(PAGE);

  async function toggle() {
    const next = !aberto;
    setAberto(next);
    if (next && !data) {
      setLoading(true);
      try {
        setData(await fetchLinhaTempoLocal(workplaceId));
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="rounded-xl border bg-slate-50/60">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Clock className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-semibold">
          Linha do tempo e histórico
        </span>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {aberto && !loading && data && (
        <div className="space-y-4 border-t p-3">
          {/* Histórico de rodadas arquivadas (aparece só se houve suplementar). */}
          {data.rodadasArquivadas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resultados por rodada
              </p>
              {data.rodadasArquivadas.map((r) => (
                <RodadaCard key={r.rodada} r={r} />
              ))}
            </div>
          )}

          {/* Cronologia dos atos oficiais. */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Passos oficiais
            </p>
            {data.eventos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem registros ainda.
              </p>
            ) : (
              <>
                <ol className="ml-1">
                  {data.eventos.slice(0, shown).map((e, i, arr) => (
                    <Evento
                      key={`${e.tipo}-${e.data}-${i}`}
                      e={e}
                      ultimo={i === arr.length - 1}
                    />
                  ))}
                </ol>
                {shown < data.eventos.length && (
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + PAGE)}
                    className="w-full rounded-md border py-2 text-xs font-medium text-slate-600 transition hover:bg-white"
                  >
                    Ver mais ({data.eventos.length - shown})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
