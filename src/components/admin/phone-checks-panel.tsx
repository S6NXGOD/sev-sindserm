"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { getPhoneAnomalies, type PhoneAnomalies } from "@/lib/actions/admin";
import { Card, CardContent } from "@/components/ui/card";

/**
 * VERIFICAÇÃO DE TELEFONES (auditoria) — só leitura. Recolhível: ao abrir,
 * carrega os telefones REPETIDOS (mesmo número em 2+ votantes) e a contagem de
 * formatos inválidos. É pista para REVISÃO manual, não prova de fraude.
 */
export function PhoneChecksPanel({ ano }: { ano: number }) {
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PhoneAnomalies | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  async function abrir(o: boolean) {
    setAberto(o);
    if (o && data === null) {
      setLoading(true);
      try {
        setData(await getPhoneAnomalies(ano));
      } finally {
        setLoading(false);
      }
    }
  }

  const nada =
    data && data.repetidos.length === 0 && data.invalidos === 0;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => abrir(!aberto)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <Phone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight sm:text-base">
            Verificação de telefones
          </p>
          <p className="text-xs text-muted-foreground">
            Telefones repetidos e formatos inválidos — pistas para revisar
            possíveis fraudes.
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aberto && (
        <CardContent className="space-y-3 border-t pt-4">
          {loading || data === null ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando os telefones…
            </p>
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-slate-50 p-2.5">
                  <div className="text-xl font-bold leading-none">
                    {data.totalComTelefone}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Com telefone
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                  <div className="text-xl font-bold leading-none text-amber-700">
                    {data.repetidos.length}
                  </div>
                  <div className="mt-1 text-[11px] text-amber-700/80">
                    Nºs repetidos
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5">
                  <div className="text-xl font-bold leading-none text-rose-700">
                    {data.invalidos}
                  </div>
                  <div className="mt-1 text-[11px] text-rose-700/80">
                    Formato inválido
                  </div>
                </div>
              </div>

              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                <strong>Atenção:</strong> um telefone repetido{" "}
                <strong>não é prova de fraude</strong> — pode ser um casal, um
                servidor sem celular que informou o número de quem o ajudou, ou
                erro de digitação. Use como ponto de partida para{" "}
                <strong>conferir manualmente</strong>. A barreira real contra voto
                duplicado é o CPF/matrícula (únicos por rodada).
              </p>

              {nada ? (
                <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Nenhum telefone repetido ou inválido encontrado.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {data.repetidos.map((r) => (
                    <li key={r.telefone}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandido((e) =>
                            e === r.telefone ? null : r.telefone,
                          )
                        }
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span className="font-mono text-sm font-medium">
                          {r.telefone}
                        </span>
                        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {r.count} votantes
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                            expandido === r.telefone ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {expandido === r.telefone && (
                        <ol className="space-y-1 border-t bg-slate-50/60 px-3 py-2 text-xs">
                          {r.votantes.map((v, i) => (
                            <li key={`${v.nome}-${i}`} className="flex gap-2">
                              <span className="w-4 shrink-0 text-muted-foreground">
                                {i + 1}.
                              </span>
                              <span className="min-w-0">
                                <span className="font-medium">{v.nome}</span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {v.local}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
