import Link from "next/link";
import { CalendarClock, Clock3 } from "lucide-react";
import { formatDateTime, tempoAte } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

/** Local com votação AGENDADA (status "upcoming"): início no futuro. */
export type ProximaAbertura = {
  id: string;
  nome: string;
  zona: string;
  orgao: string;
  /** ISO — serializável do server component para o cliente. */
  inicio: string;
};

/** Abre em menos de 24h → destaque (é a fila logística imediata). */
const EM_BREVE_MS = 24 * 60 * 60 * 1000;

/**
 * "Próximas aberturas" — locais cuja votação JÁ foi agendada e vai abrir.
 * Componente ÚNICO, usado na Dashboard (admin, com link para o local) e no
 * Portal da Transparência (público, sem link). Server component puro.
 *
 * ANTI-OVERFLOW (o motivo de cada classe — nomes/órgãos aqui são LONGOS, ex.:
 * "GERÊNCIA DE REGULAÇÃO, CONTROLE E AVALIAÇÃO AMBULATORIAL"):
 *  - `min-w-0` em TODO elo que é flex/grid item. Grid e flex items nascem com
 *    `min-width: auto`, que impede o encolhimento abaixo do conteúdo mínimo.
 *    Como o `truncate` aplica `white-space: nowrap`, o "conteúdo mínimo" vira a
 *    frase inteira — e a trilha do grid estoura a largura da tela. Basta UM elo
 *    sem `min-w-0` para a corrente de truncate quebrar e a página ganhar scroll
 *    horizontal. Por isso o `<li>` (grid item) TAMBÉM leva `min-w-0`.
 *  - O card é um BLOCO (não uma linha flex): a data e o selo ficam numa linha
 *    própria embaixo, então o selo nunca disputa largura com o nome. Num celular
 *    de 360px isso é a diferença entre respirar e espremer.
 */
export function ProximasAberturas({
  itens,
  total,
  hrefBase,
  titulo = "Próximas aberturas",
  descricao = "Votações já agendadas que vão abrir em breve.",
  vazioTexto = "Nenhuma votação agendada no momento.",
}: {
  itens: ProximaAbertura[];
  /** Total de agendadas (pode ser maior que `itens`, que é limitado). */
  total: number;
  /** Ex.: "/admin/locais" — quando ausente, o nome não vira link (portal público). */
  hrefBase?: string;
  titulo?: string;
  descricao?: string;
  vazioTexto?: string;
}) {
  const agora = new Date();

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b p-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <CalendarClock className="h-5 w-5 shrink-0 text-sky-600" />
            <span className="min-w-0 truncate">{titulo}</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        </div>
        {total > 0 && (
          <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
            {total} agendada{total === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {itens.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
          <Clock3 className="h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{vazioTexto}</p>
        </div>
      ) : (
        <>
          <ul className="grid gap-2 p-3 sm:grid-cols-2">
            {itens.map((l) => {
              const inicio = new Date(l.inicio);
              const emBreve = inicio.getTime() - agora.getTime() <= EM_BREVE_MS;

              return (
                <li
                  key={l.id}
                  className={`min-w-0 rounded-lg border p-3 ${
                    emBreve ? "border-amber-300 bg-amber-50" : "bg-background"
                  }`}
                >
                  {/* Nome — sempre em linha própria, truncado. */}
                  {hrefBase ? (
                    <Link
                      href={`${hrefBase}/${l.id}`}
                      className="block truncate text-sm font-semibold leading-tight hover:underline"
                    >
                      {l.nome}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-semibold leading-tight">
                      {l.nome}
                    </p>
                  )}

                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {l.orgao} · Zona {l.zona}
                  </p>

                  {/* Data à esquerda, contagem à direita — linha própria, então
                      o selo não espreme o nome nem estoura a largura. */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {formatDateTime(inicio)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`shrink-0 whitespace-nowrap ${
                        emBreve
                          ? "border-amber-400 bg-amber-100 text-amber-800"
                          : "border-sky-300 bg-sky-50 text-sky-700"
                      }`}
                    >
                      {tempoAte(inicio, agora)}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>

          {total > itens.length && (
            <p className="border-t px-4 py-2.5 text-center text-xs text-muted-foreground">
              Mostrando as {itens.length} mais próximas de {total} agendadas.
            </p>
          )}
        </>
      )}
    </section>
  );
}
