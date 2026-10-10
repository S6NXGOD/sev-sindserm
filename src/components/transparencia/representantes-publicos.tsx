"use client";

import { useMemo, useState } from "react";
import { Award, History, Search, UserCheck, Users } from "lucide-react";
import type { RepresentantePublico } from "@/lib/mandato";
import { MOTIVO_LABEL } from "@/lib/mandato-constants";
import { searchScore, searchTokens } from "@/lib/slug";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/** Tag do papel/situação do representante no mandato. */
function Tag({ m }: { m: RepresentantePublico }) {
  if (m.situacao === "AFASTADO")
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-700">
        Afastado
      </Badge>
    );
  if (m.papel === "SUPLENTE" && m.assumiuEm)
    return <Badge className="bg-sky-600 hover:bg-sky-600">Suplente convocado</Badge>;
  return <Badge variant="success">Titular</Badge>;
}

/**
 * REPRESENTANTES DO TRIÊNIO (mandato vigente) — visão pública pós-homologação.
 * Diferente do Mural (que mostra o RESULTADO da eleição, derivado dos votos),
 * este bloco mostra QUEM REPRESENTA HOJE: reflete posses, licenças e sucessões.
 * Só é renderizado quando há mandatos homologados. Sem PII (nome/local/zona).
 */
export function RepresentantesPublicos({
  vigentes,
  sucessoes,
  trienio,
}: {
  vigentes: RepresentantePublico[];
  sucessoes: RepresentantePublico[];
  trienio: string;
}) {
  const [q, setQ] = useState("");
  const [verSuc, setVerSuc] = useState(false);

  const tokens = searchTokens(q);
  const filtrados = vigentes.filter(
    (m) =>
      tokens.length === 0 ||
      searchScore(`${m.nome} ${m.localNome} ${m.orgao} ${m.zona}`, tokens) > 0,
  );

  // Agrupa por órgão (ordem alfabética), e por local dentro do órgão.
  const grupos = useMemo(() => {
    const byOrgao = new Map<string, RepresentantePublico[]>();
    for (const m of filtrados) {
      const arr = byOrgao.get(m.orgao) ?? [];
      arr.push(m);
      byOrgao.set(m.orgao, arr);
    }
    return [...byOrgao.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt"))
      .map(([orgao, itens]) => ({
        orgao,
        itens: itens.sort(
          (a, b) =>
            a.localNome.localeCompare(b.localNome, "pt") ||
            a.nome.localeCompare(b.nome, "pt"),
        ),
      }));
  }, [filtrados]);

  const orgaosCount = new Set(vigentes.map((m) => m.orgao)).size;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Award className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Representantes do triênio {trienio}
            </h2>
            <p className="text-xs text-muted-foreground">
              Mandato vigente — reflete posses, licenças e substituições.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
            <Users className="h-3.5 w-3.5 text-emerald-600" />
            {vigentes.length} em exercício
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
            {orgaosCount} órgão(s)
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar representante, local ou órgão..."
            className="h-11 pl-9"
          />
        </div>

        {grupos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum representante encontrado para “{q}”.
          </p>
        ) : (
          <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
            {grupos.map((g) => (
              <div key={g.orgao}>
                <p className="sticky top-0 z-10 bg-card/95 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {g.orgao} · {g.itens.length}
                </p>
                <ul className="divide-y rounded-lg border">
                  {g.itens.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3"
                    >
                      <UserCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="font-medium text-slate-900">{m.nome}</span>
                      <Tag m={m} />
                      <span className="w-full text-xs text-muted-foreground sm:w-auto">
                        {m.localNome} · Zona {m.zona}
                        {m.papel === "SUPLENTE" && m.substituiuNome
                          ? ` · no lugar de ${m.substituiuNome}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Substituições no mandato — transparência da sucessão. */}
        {sucessoes.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <button
              type="button"
              onClick={() => setVerSuc((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              <History className="h-4 w-4" />
              Substituições no mandato ({sucessoes.length})
            </button>
            {verSuc && (
              <ul className="mt-2 space-y-1.5 border-l-2 border-slate-200 pl-3 text-xs text-muted-foreground">
                {sucessoes.map((m) => (
                  <li key={m.id}>
                    <span className="font-medium text-slate-700">{m.nome}</span> (
                    {m.localNome}) deixou o mandato
                    {m.saidaMotivo ? ` — ${MOTIVO_LABEL[m.saidaMotivo]}` : ""}
                    {m.saidaEm
                      ? ` em ${new Date(m.saidaEm).toLocaleDateString("pt-BR")}`
                      : ""}
                    .
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
