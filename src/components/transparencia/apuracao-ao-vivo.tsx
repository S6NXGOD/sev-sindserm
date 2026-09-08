import { Crown, Radio, Users } from "lucide-react";
import type { LiderancaAoVivo } from "@/lib/transparencia";

/**
 * "Apuração ao vivo": locais com votação EM ANDAMENTO agora. Mostra sempre o
 * COMPARECIMENTO (quantos já votaram) e — só quando a diretoria habilitou as
 * parciais públicas — o LÍDER parcial de cada local (claramente rotulado como
 * "parcial · pode mudar"). A página se atualiza sozinha (polling), então isto é
 * o "tempo real" do portal.
 */
export function ApuracaoAoVivo({
  itens,
  parciaisPublicas,
}: {
  itens: LiderancaAoVivo[];
  parciaisPublicas: boolean;
}) {
  if (itens.length === 0) return null;

  return (
    <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-emerald-900">
          <Radio className="h-5 w-5 text-emerald-600" />
          Apuração ao vivo
          {/* Indicador "ao vivo" pulsante. */}
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
          </span>
        </h2>
        <span className="rounded-full border border-emerald-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          {itens.length} em andamento · atualiza sozinho
        </span>
      </div>

      {!parciaisPublicas && (
        <p className="mb-3 text-xs text-emerald-800">
          Mostrando a <strong>participação em tempo real</strong>. Quem está
          liderando aparece quando cada votação <strong>encerra</strong>.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {itens.map((l) => (
          <li
            key={l.id}
            className="min-w-0 rounded-xl border border-emerald-200 bg-white p-3"
          >
            <p className="truncate text-sm font-bold">{l.nome}</p>
            <p className="truncate text-xs text-muted-foreground">
              {l.orgao} · Zona {l.zona}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <Users className="h-3.5 w-3.5" />
                {l.votantes} {l.votantes === 1 ? "voto" : "votos"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Em andamento
              </span>
            </div>

            {parciaisPublicas && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                {l.lider ? (
                  <>
                    <p className="flex items-center gap-1.5 text-sm">
                      <Crown className="h-4 w-4 shrink-0 text-amber-600" />
                      <span className="min-w-0 truncate font-semibold">
                        {l.lider.nome}
                      </span>
                      <span className="ml-auto shrink-0 text-xs font-bold tabular-nums text-amber-800">
                        {l.lider.votos} {l.lider.votos === 1 ? "voto" : "votos"}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-amber-700">
                      Parcial · pode mudar até o encerramento
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-700">
                    Ainda sem votos computados.
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
