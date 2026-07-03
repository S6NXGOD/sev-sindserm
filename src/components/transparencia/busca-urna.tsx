"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Search, Vote } from "lucide-react";
import { searchUrnas, type UrnaPublica } from "@/lib/actions/transparencia";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/admin/copy-button";

/** Skeleton leve enquanto a busca carrega (evita "pulo" de layout). */
function UrnaSkeleton() {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border bg-background p-3"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-8 w-16 shrink-0 animate-pulse rounded-md bg-slate-200" />
        </li>
      ))}
    </ul>
  );
}

/**
 * "Não sabe onde vota?" — busca leve (Mobile-First) do local de votação. A busca
 * só dispara ao apertar Enter ou o botão "Buscar" (nunca por tecla), mostra um
 * skeleton enquanto carrega e lista as urnas em cards compactos.
 */
export function BuscaUrna({ electionId }: { electionId: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UrnaPublica[] | null>(null); // null = sem busca ainda
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState("");
  const reqId = useRef(0);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    const termo = q.trim();
    if (termo.length < 2) return;
    setLoading(true);
    const meu = ++reqId.current;
    try {
      const res = await searchUrnas(electionId, termo);
      if (meu === reqId.current) setResults(res);
    } catch {
      if (meu === reqId.current) setResults([]);
    } finally {
      if (meu === reqId.current) setLoading(false);
    }
  }

  const podeBuscar = q.trim().length >= 2;

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight sm:text-lg">
            Não sabe onde vota?
          </h2>
          <p className="text-sm text-muted-foreground">
            Busque seu local de trabalho e acesse sua urna.
          </p>
        </div>
      </div>

      {/* Busca só ao enviar (Enter ou botão) — sem consultar a cada tecla. */}
      <form onSubmit={buscar} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value.trim()) setResults(null);
            }}
            placeholder="Nome do local ou órgão…"
            className="h-12 pl-9 text-base"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Buscar local de votação"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !podeBuscar}
          className="h-12 sm:w-auto"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Buscar
        </Button>
      </form>

      <div className="mt-4">
        {loading ? (
          <UrnaSkeleton />
        ) : results === null ? (
          <p className="text-center text-xs text-muted-foreground">
            Digite o nome do local (mín. 2 letras) e toque em <b>Buscar</b>.
          </p>
        ) : results.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-slate-50 py-6 text-center text-sm text-muted-foreground">
            Nenhum local encontrado. Tente outro nome ou o órgão.
          </div>
        ) : (
          <>
            <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
              {results.map((l) => {
                const url = origin
                  ? `${origin}/votacao/${l.linkToken}`
                  : `/votacao/${l.linkToken}`;
                return (
                  <li
                    key={l.id}
                    className="flex items-center gap-3 rounded-xl border bg-background p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {l.nome}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.orgao} · Zona {l.zona}
                      </p>
                    </div>
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={`/votacao/${l.linkToken}`}>
                        <Vote className="mr-1.5 h-4 w-4" />
                        Votar
                      </Link>
                    </Button>
                    <CopyButton value={url} size="icon" />
                  </li>
                );
              })}
            </ul>
            {results.length >= 8 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Refine a busca (nome + órgão) para encontrar mais rápido.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
