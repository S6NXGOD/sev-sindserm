"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Flag,
  History,
  Loader2,
  MapPin,
  Repeat,
  RotateCcw,
  Search,
  Users,
  UserX,
} from "lucide-react";
import { fetchHistoricoDiretoria } from "@/lib/actions/transparencia";
import type { AtividadeItem } from "@/lib/transparencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { normalizeForSearch } from "@/lib/slug";

const ESTILO: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; cor: string; ring: string }
> = {
  AGENDAMENTO: { Icon: CalendarClock, cor: "text-sky-600", ring: "bg-sky-100" },
  ENCERRAMENTO: { Icon: Flag, cor: "text-slate-700", ring: "bg-slate-200" },
  REABERTURA: { Icon: RotateCcw, cor: "text-amber-600", ring: "bg-amber-100" },
  SUPLEMENTAR: { Icon: Repeat, cor: "text-violet-600", ring: "bg-violet-100" },
  RENUNCIA: { Icon: UserX, cor: "text-rose-600", ring: "bg-rose-100" },
  DISPENSA: { Icon: Ban, cor: "text-slate-600", ring: "bg-slate-100" },
  DECISAO: { Icon: CheckCircle2, cor: "text-emerald-600", ring: "bg-emerald-100" },
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

/**
 * Uma linha de ato. `compact` (usado na prévia recolhível) esconde a caixa de
 * detalhe e aperta o espaçamento; o modal usa a versão completa (com detalhe).
 */
function Ato({ e, compact = false }: { e: AtividadeItem; compact?: boolean }) {
  const st = ESTILO[e.tipo] ?? ESTILO.DISPENSA;
  return (
    <li className={`flex gap-3 px-4 sm:px-5 ${compact ? "py-2.5" : "py-3"}`}>
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${st.ring} ${
          compact ? "h-7 w-7" : "h-8 w-8"
        }`}
      >
        <st.Icon className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} ${st.cor}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{e.titulo}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{e.localNome}</span>
        </p>
        {!compact && e.detalhe && (
          <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
            {e.detalhe}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {fmt(e.data)}
          {e.autorNome ? ` · ${e.autorNome}` : ""}
        </p>
      </div>
    </li>
  );
}

const PREVIA = 5;
const PAG = 40;

/**
 * "O que a diretoria andou fazendo" — barra RECOLHÍVEL (fechada por padrão, como
 * as seções de Auditoria e Base legal logo acima) para não ocupar muito espaço.
 * Fechada, mostra um teaser do último ato. Aberta, revela uma prévia enxuta dos
 * mais recentes + "Ver todo o histórico" (modal com busca) que carrega TUDO.
 */
export function AtividadeDiretoria({
  itens,
  electionId,
}: {
  itens: AtividadeItem[];
  electionId: string;
}) {
  const [aberto, setAberto] = useState(false);

  // Histórico completo (lazy, no modal).
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<AtividadeItem[] | null>(null);
  const [q, setQ] = useState("");
  const [mostrar, setMostrar] = useState(PAG);

  async function abrirHistorico(o: boolean) {
    setOpen(o);
    if (o && historico === null) {
      setLoading(true);
      try {
        setHistorico(await fetchHistoricoDiretoria(electionId));
      } finally {
        setLoading(false);
      }
    }
    if (o) {
      setQ("");
      setMostrar(PAG);
    }
  }

  const filtrado = useMemo(() => {
    if (!historico) return [];
    const termo = normalizeForSearch(q);
    if (!termo) return historico;
    return historico.filter(
      (e) =>
        normalizeForSearch(e.localNome).includes(termo) ||
        normalizeForSearch(e.titulo).includes(termo) ||
        (e.autorNome && normalizeForSearch(e.autorNome).includes(termo)),
    );
  }, [historico, q]);

  if (itens.length === 0) return null;
  const ultimo = itens[0];
  const previa = itens.slice(0, PREVIA);

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      {/* Barra recolhível — fechada por padrão. Clique para abrir/fechar. */}
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight sm:text-base">
            O que a diretoria andou fazendo
          </p>
          {/* Fechada: teaser do último ato (transparência já no relance).
              Aberta: descrição do bloco. */}
          <p className="truncate text-xs text-muted-foreground">
            {aberto ? (
              "Cada passo oficial no pleito — com quem fez e quando."
            ) : (
              <>
                Último: <span className="font-medium text-slate-600">{ultimo.titulo}</span>
                {" · "}
                {ultimo.localNome}
              </>
            )}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aberto && (
        <div className="border-t">
          <ol className="divide-y">
            {previa.map((e, i) => (
              <Ato key={`${e.data}-${i}`} e={e} compact />
            ))}
          </ol>

          {/* Rodapé: abre o histórico COMPLETO (modal com busca). */}
          <Dialog open={open} onOpenChange={abrirHistorico}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 border-t py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <History className="h-4 w-4" />
                Ver todo o histórico
              </button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col overflow-hidden p-0">
              <DialogHeader className="border-b p-4 sm:p-5">
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico da diretoria
                </DialogTitle>
                <DialogDescription>
                  Tudo o que a diretoria fez no pleito — inclusive os atos
                  anteriores. Busque por local, ato ou responsável.
                </DialogDescription>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setMostrar(PAG);
                    }}
                    placeholder="Ex.: CMEI Helena, agendou, Diana…"
                    className="h-10 pl-9"
                  />
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading || historico === null ? (
                  <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando o histórico…
                  </p>
                ) : filtrado.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Nenhum ato encontrado.
                  </p>
                ) : (
                  <>
                    <p className="px-4 pt-3 text-xs text-muted-foreground sm:px-5">
                      {filtrado.length} ato(s)
                      {q ? " encontrados" : " no total"}.
                    </p>
                    <ol className="divide-y">
                      {filtrado.slice(0, mostrar).map((e, i) => (
                        <Ato key={`${e.data}-${e.localId}-${i}`} e={e} />
                      ))}
                    </ol>
                    {mostrar < filtrado.length && (
                      <button
                        type="button"
                        onClick={() => setMostrar((n) => n + PAG)}
                        className="flex w-full items-center justify-center gap-1.5 border-t py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Ver mais ({filtrado.length - mostrar})
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </section>
  );
}
