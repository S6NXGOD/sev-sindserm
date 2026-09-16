import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import type { Apuracao } from "@/lib/reports";
import { Button } from "@/components/ui/button";

/**
 * EMPATES A DESEMPATAR — locais travados por empate na linha de corte. Fica no
 * topo de "Encerradas & Eleitos". A ORIENTAÇÃO aparece uma vez (no topo), e cada
 * card fica limpo: nome, empatados e a ação. O SEV não guarda idade/tempo de
 * serviço, então o desempate é decisão do sindicato (registrada em ata).
 */
export function EmpatesPanel({ empates }: { empates: Apuracao[] }) {
  if (empates.length === 0) return null;

  return (
    <section className="sev-rise overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Cabeçalho + orientação (uma vez só). */}
      <div className="border-b bg-amber-50/70 p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Scale className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-amber-900">
              Empates a desempatar
            </h2>
            <p className="text-xs text-amber-700">
              {empates.length} local(is) com resultado travado
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-amber-800">
          Os empatados têm exatamente os mesmos votos. Defina o critério pelo
          estatuto (tempo de serviço/idade) ou sorteio em assembleia; depois abra
          o local e marque quem <strong>não assume</strong> (motivo:{" "}
          <strong>Desempate</strong>) — o outro é promovido automaticamente.
          Registre a decisão em ata.
        </p>
      </div>

      <div className="sev-stagger grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
        {empates.map((a) => (
          <div
            key={a.id}
            className="sev-hover-lift min-w-0 overflow-hidden rounded-xl border border-l-4 border-l-amber-400 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.orgao} · Zona {a.zona}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                {a.vagasEmDisputa} {a.vagasEmDisputa === 1 ? "vaga" : "vagas"}
              </span>
            </div>

            <p className="mt-2.5 text-xs font-medium text-slate-600">
              {a.empatados.length} empatados
              {a.empatadosVotos !== null ? ` · ${a.empatadosVotos} voto(s) cada` : ""}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {a.empatados.map((nome) => (
                <li
                  key={nome}
                  className="max-w-full break-words rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                >
                  {nome}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex justify-end">
              <Button asChild size="sm">
                <Link href={`/admin/locais/${a.id}`}>
                  Resolver no local
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
