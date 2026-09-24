"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, ChevronDown, Lock, Radio, Repeat, Vote } from "lucide-react";

type SuplementarInfo = {
  id: string;
  nome: string;
  status: "open" | "closed" | "upcoming" | "undefined";
  dataInicio: string | null;
  dataFim: string | null;
};

function fmt(iso: string | null): string {
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

/**
 * Aviso público de ELEIÇÕES SUPLEMENTARES (2ª rodada+). Distingue com honestidade
 * o que está "em andamento" (votando agora) do que está apenas "agendado" (vai
 * abrir) e MOSTRA A JANELA (abre/encerra) de cada local — antes o texto dizia
 * "está em eleição suplementar" mesmo quando ainda nem tinha começado. Some
 * quando não há suplementar aberta nem agendada. O botão filtra os cards.
 */
export function SuplementarAviso({ itens }: { itens: SuplementarInfo[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [aberto, setAberto] = useState(false);

  // Só interessa o que está VOTANDO agora ou VAI abrir. Encerradas não alarmam.
  const relevantes = itens.filter(
    (l) => l.status === "open" || l.status === "upcoming",
  );
  if (relevantes.length === 0) return null;

  const abertas = relevantes.filter((l) => l.status === "open");
  const agendadas = relevantes.filter((l) => l.status === "upcoming");

  const titulo =
    abertas.length > 0 && agendadas.length > 0
      ? "Eleições suplementares em andamento e agendadas"
      : abertas.length > 0
        ? abertas.length === 1
          ? "1 local em eleição suplementar agora"
          : `${abertas.length} locais em eleição suplementar agora`
        : agendadas.length === 1
          ? "1 eleição suplementar agendada"
          : `${agendadas.length} eleições suplementares agendadas`;

  function verLocais() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", "suplementar");
    router.push(`/transparencia?${params.toString()}`, { scroll: false });
    setTimeout(() => {
      document
        .getElementById("resultados-locais")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  const soUm = relevantes.length === 1;

  return (
    <section
      data-tour="suplementar"
      className="overflow-hidden rounded-2xl border-2 border-violet-200 bg-violet-50 shadow-sm"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
        <div className="flex shrink-0 items-center justify-center rounded-xl bg-violet-600 p-3 text-white">
          <Repeat className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-violet-900">{titulo}</p>
          <p className="text-sm text-violet-800">
            Uma nova rodada de votação para preencher as vagas que ainda
            faltam — abrindo oportunidade a mais candidatos.
          </p>

          {/* Cada local com o SEU período — o filiado sabe exatamente quando é. */}
          <ul className="mt-3 space-y-1.5">
            {relevantes.slice(0, 5).map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-white/70 px-3 py-2 text-sm"
              >
                {l.status === "open" ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                    <Radio className="h-3.5 w-3.5" />
                    Votando agora
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Agendada
                  </span>
                )}
                <span className="min-w-0 font-medium text-violet-950">
                  {l.nome}
                </span>
                <span className="w-full text-xs text-violet-800 sm:w-auto">
                  {l.status === "open"
                    ? `encerra ${fmt(l.dataFim)}`
                    : `abre ${fmt(l.dataInicio)} · encerra ${fmt(l.dataFim)}`}
                </span>
              </li>
            ))}
            {relevantes.length > 5 && (
              <li className="px-3 text-xs text-violet-700">
                +{relevantes.length - 5} outro(s) — veja na lista de locais.
              </li>
            )}
          </ul>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={verLocais}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <Vote className="h-4 w-4" />
            {soUm ? "Ver esse local" : "Ver esses locais"}
          </button>
          <button
            type="button"
            onClick={() => setAberto((o) => !o)}
            aria-expanded={aberto}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3.5 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            Como funciona
            <ChevronDown
              className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {aberto && (
        <div className="border-t border-violet-200 bg-white/70 p-4 text-sm text-violet-900 sm:p-5">
          <ol className="space-y-3">
            <li className="flex gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>
                <strong>Os já eleitos são preservados.</strong> Quem foi eleito
                na rodada anterior mantém a vaga e{" "}
                <strong>não volta para a cédula</strong> — aparece marcado como
                “Eleito (rodada anterior)”.
              </span>
            </li>
            <li className="flex gap-3">
              <Vote className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>
                <strong>Disputa só as vagas que sobraram.</strong> A nova rodada
                elege apenas o número de representantes que ainda falta para
                completar as vagas do local.
              </span>
            </li>
            <li className="flex gap-3">
              <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>
                <strong>Você pode votar de novo.</strong> Cada rodada tem sua
                própria votação: os votos anteriores ficam guardados no
                histórico e a apuração desta rodada é independente e auditável.
              </span>
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}
