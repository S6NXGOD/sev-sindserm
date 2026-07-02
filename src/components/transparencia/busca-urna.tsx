"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Search, Vote } from "lucide-react";
import { searchUrnas, type UrnaPublica } from "@/lib/actions/transparencia";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/admin/copy-button";

/**
 * "Não sabe onde vota?" — busca pública (Mobile-First) do local de votação.
 * O filiado digita e a lista de urnas aparece abaixo; cada card leva à URL
 * exata de votação ("Ir para Votação") e permite copiar o link.
 */
export function BuscaUrna({ electionId }: { electionId: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UrnaPublica[]>([]);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState("");
  const reqId = useRef(0);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const meu = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await searchUrnas(electionId, termo);
        if (meu === reqId.current) setResults(res);
      } catch {
        if (meu === reqId.current) setResults([]);
      } finally {
        if (meu === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, electionId]);

  const buscou = q.trim().length >= 2;

  return (
    <section className="rounded-xl border-2 border-primary/20 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-start gap-2">
        <Vote className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h2 className="text-lg font-bold leading-tight">
            Não sabe onde vota?
          </h2>
          <p className="text-sm text-muted-foreground">
            Busque seu local de trabalho e acesse sua urna.
          </p>
        </div>
      </div>

      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Digite o nome do local ou órgão…"
          className="h-12 pl-9 text-base"
          autoComplete="off"
          inputMode="search"
          aria-label="Buscar local de votação"
        />
      </div>

      {buscou && (
        <div className="mt-3 space-y-2">
          {loading ? null : results.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum local encontrado. Tente outro nome ou o órgão.
            </p>
          ) : (
            results.map((l) => {
              const url = origin
                ? `${origin}/votacao/${l.linkToken}`
                : `/votacao/${l.linkToken}`;
              return (
                <div key={l.id} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{l.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.orgao} · Zona {l.zona}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button asChild className="flex-1">
                      <Link href={`/votacao/${l.linkToken}`}>
                        <Vote className="mr-2 h-4 w-4" />
                        Ir para Votação
                      </Link>
                    </Button>
                    <CopyButton value={url} size="icon" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
