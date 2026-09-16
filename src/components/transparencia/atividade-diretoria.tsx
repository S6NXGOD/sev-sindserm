"use client";

import { useState } from "react";
import {
  Ban,
  CalendarClock,
  ChevronDown,
  Flag,
  MapPin,
  Repeat,
  RotateCcw,
  Users,
  UserX,
} from "lucide-react";
import type { AtividadeItem } from "@/lib/transparencia";

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

const INICIAL = 6;

/**
 * "Atividade da diretoria" — feed público dos atos oficiais mais recentes (quem
 * agendou/encerrou/abriu suplementar/dispensou, e quando), em todos os locais.
 * Transparência do trabalho da diretoria. Recolhido a 6; expande sob demanda.
 */
export function AtividadeDiretoria({ itens }: { itens: AtividadeItem[] }) {
  const [todos, setTodos] = useState(false);
  if (itens.length === 0) return null;
  const visiveis = todos ? itens : itens.slice(0, INICIAL);

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b bg-slate-50/70 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight sm:text-base">
            O que a diretoria andou fazendo
          </h2>
          <p className="text-xs text-muted-foreground">
            Cada passo oficial no pleito — com quem fez e quando.
          </p>
        </div>
      </div>

      <ol className="divide-y">
        {visiveis.map((e, i) => {
          const st = ESTILO[e.tipo] ?? ESTILO.DISPENSA;
          const motivo =
            e.tipo === "DISPENSA" && e.detalhe ? e.detalhe : null;
          return (
            <li key={`${e.data}-${i}`} className="flex gap-3 px-4 py-3 sm:px-5">
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
        })}
      </ol>

      {itens.length > INICIAL && (
        <button
          type="button"
          onClick={() => setTodos((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {todos ? "Mostrar menos" : `Ver mais (${itens.length - INICIAL})`}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${todos ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </section>
  );
}
