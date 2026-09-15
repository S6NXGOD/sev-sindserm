"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Lock, Repeat, Vote } from "lucide-react";

/**
 * Aviso público de que há ELEIÇÕES SUPLEMENTARES em andamento (2ª rodada+).
 * Aparece só quando existe ao menos um local em rodada 2+. Explica, em
 * linguagem simples, o que é, por que os já eleitos não concorrem de novo e
 * como as vagas restantes são preenchidas — para o filiado entender a lisura.
 * O botão filtra os cards para mostrar só os locais em suplementar.
 */
export function SuplementarAviso({ total }: { total: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [aberto, setAberto] = useState(false);

  if (total <= 0) return null;

  function verLocais() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", "suplementar");
    router.push(`/transparencia?${params.toString()}`, { scroll: false });
    // Leva o filiado até a grade de resultados.
    setTimeout(() => {
      document
        .getElementById("resultados-locais")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-violet-200 bg-violet-50 shadow-sm">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className="flex shrink-0 items-center justify-center rounded-xl bg-violet-600 p-3 text-white">
          <Repeat className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-violet-900">
            {total === 1
              ? "1 local está em eleição suplementar"
              : `${total} locais estão em eleição suplementar`}
          </p>
          <p className="text-sm text-violet-800">
            Uma nova rodada de votação para preencher as vagas que ainda
            faltam — abrindo oportunidade a mais candidatos.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={verLocais}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <Vote className="h-4 w-4" />
            Ver esses locais
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
