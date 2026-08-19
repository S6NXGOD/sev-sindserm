import Link from "next/link";
import { AlertTriangle, ArrowRight, Scale } from "lucide-react";
import type { Apuracao } from "@/lib/reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * EMPATES A DESEMPATAR — locais cujo resultado está travado por empate na linha
 * de corte. Fica no TOPO de "Encerradas & Eleitos" para o admin resolver rápido.
 *
 * HONESTIDADE: o SEV não guarda idade/tempo de serviço, então NÃO dá para
 * desempatar automaticamente de forma justa (os empatados têm exatamente os
 * mesmos votos). O painel deixa o empate claro e orienta o método de desempate;
 * a decisão (estatuto/assembleia/sorteio) e o registro são do sindicato.
 */
export function EmpatesPanel({ empates }: { empates: Apuracao[] }) {
  if (empates.length === 0) return null;

  return (
    <section className="rounded-xl border-2 border-amber-300 bg-amber-50 shadow-sm">
      <div className="flex items-center gap-2 border-b border-amber-200 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <h2 className="text-base font-bold text-amber-900">
          Empates a desempatar
        </h2>
        <Badge variant="outline" className="border-amber-400 bg-white text-amber-800">
          {empates.length} local(is)
        </Badge>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-2">
        {empates.map((a) => (
          <div key={a.id} className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.orgao} · Zona {a.zona}
                </p>
              </div>
              <Badge className="shrink-0 bg-amber-600 hover:bg-amber-600">
                {a.vagasEmDisputa} {a.vagasEmDisputa === 1 ? "vaga" : "vagas"} em
                disputa
              </Badge>
            </div>

            <p className="mt-2 text-sm">
              <strong>{a.empatados.length} candidato(s)</strong> empatados
              {a.empatadosVotos !== null
                ? ` com ${a.empatadosVotos} voto(s) cada`
                : ""}
              :
            </p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {a.empatados.map((nome) => (
                <li
                  key={nome}
                  className="rounded-full border border-amber-300 bg-amber-100/70 px-2.5 py-0.5 text-xs font-medium text-amber-900"
                >
                  {nome}
                </li>
              ))}
            </ul>

            {/* Sugestão de desempate (método — não há dado para automatizar). */}
            <div className="mt-3 flex items-start gap-2 rounded-md bg-slate-50 p-2.5 text-xs text-slate-600">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>
                <strong className="text-slate-700">Sugestão de desempate:</strong>{" "}
                os empatados têm os mesmos votos — aplique o critério do estatuto
                (ex.: maior tempo de serviço ou maior idade) ou faça sorteio em
                assembleia e registre a ata. O sistema não possui esses dados para
                decidir sozinho.
              </p>
            </div>

            <div className="mt-3 flex justify-end">
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/locais/${a.id}`}>
                  Abrir local
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
