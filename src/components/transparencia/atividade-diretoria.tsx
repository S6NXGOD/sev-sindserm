"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
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

function Ato({ e }: { e: AtividadeItem }) {
  const st = ESTILO[e.tipo] ?? ESTILO.DISPENSA;
  const motivo = e.tipo === "DISPENSA" && e.detalhe ? e.detalhe : null;
  return (
    <li className="flex gap-3 px-4 py-3 sm:px-5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${st.ring}`}
      >
        <st.Icon className={`h-4 w-4 ${st.cor}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{e.titulo}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{e.localNome}</span>
        </p>
        {motivo && (
          <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
            {motivo}
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

const INICIAL = 6;
const PAG = 40;

/**
 * "Atividade da diretoria" — feed público dos atos oficiais mais recentes +
 * "Ver todo o histórico" (modal com busca) que carrega TUDO sob demanda,
 * inclusive os atos antigos (recuperados de cada local). Transparência total.
 */
export function AtividadeDiretoria({
  itens,
  electionId,
}: {
  itens: AtividadeItem[];
  electionId: string;
}) {
  const [maisRecentes, setMaisRecentes] = useState(false);

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
  const recentes = maisRecentes ? itens : itens.slice(0, INICIAL);

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b bg-slate-50/70 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold tracking-tight sm:text-base">
            O que a diretoria andou fazendo
          </h2>
          <p className="text-xs text-muted-foreground">
            Cada passo oficial no pleito — com quem fez e quando.
          </p>
        </div>
        <Dialog open={open} onOpenChange={abrirHistorico}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Todo o histórico</span>
              <span className="sm:hidden">Histórico</span>
            </Button>
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

      <ol className="divide-y">
        {recentes.map((e, i) => (
          <Ato key={`${e.data}-${i}`} e={e} />
        ))}
      </ol>

      {itens.length > INICIAL && (
        <button
          type="button"
          onClick={() => setMaisRecentes((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {maisRecentes ? "Mostrar menos" : `Ver mais recentes (${itens.length - INICIAL})`}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${maisRecentes ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </section>
  );
}
