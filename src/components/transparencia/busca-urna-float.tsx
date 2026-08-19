"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Search, Vote, X } from "lucide-react";
import { searchUrnas, type UrnaPublica } from "@/lib/actions/transparencia";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/admin/copy-button";

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
 * "Não sabe onde vota?" agora como WIDGET FLUTUANTE (FAB) — em vez de ocupar um
 * bloco fixo na página. Um botão flutuante no canto abre um cartão-conversa que
 * convida o filiado a digitar o local e o ajuda a achar a urna. A busca só
 * dispara no Enter/botão (nunca por tecla) e fecha o teclado do celular.
 */
export function BuscaUrnaFloat({ electionId }: { electionId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UrnaPublica[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState("");
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  // Foca o campo ao abrir; ESC fecha.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
      window.addEventListener("keydown", onKey);
      return () => {
        clearTimeout(t);
        window.removeEventListener("keydown", onKey);
      };
    }
  }, [open]);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    const termo = q.trim();
    if (termo.length < 2) return;
    inputRef.current?.blur();
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
    <>
      {/* FAB — botão flutuante convidativo. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-6 sm:right-6"
          aria-label="Não sabe onde vota? Encontre sua urna"
        >
          <MapPin className="h-5 w-5" />
          <span className="hidden sm:inline">Não sabe onde vota?</span>
          <span className="sm:hidden">Onde voto?</span>
        </button>
      )}

      {/* Painel flutuante (bottom sheet no mobile, cartão no canto no desktop). */}
      {open && (
        <>
          {/* Backdrop (fecha ao tocar fora) */}
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Encontre sua urna"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border bg-card shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-h-[70vh] sm:w-[400px] sm:rounded-2xl"
          >
            {/* Cabeçalho-conversa */}
            <div className="flex items-start gap-3 border-b p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">
                  Olá, filiado! 👋
                </p>
                <p className="text-xs text-muted-foreground">
                  Não sabe o link de votação do seu local de trabalho? Digite
                  abaixo que a gente te ajuda a encontrar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Busca */}
            <form onSubmit={buscar} className="flex gap-2 p-4 pb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    if (!e.target.value.trim()) setResults(null);
                  }}
                  placeholder="Nome do local ou órgão…"
                  className="h-11 pl-9"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  aria-label="Buscar local de votação"
                />
              </div>
              <Button type="submit" disabled={loading || !podeBuscar} className="h-11 shrink-0">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">Buscar</span>
              </Button>
            </form>

            {/* Resultados (rolam dentro do painel) */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <UrnaSkeleton />
              ) : results === null ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Digite o nome do local (mín. 2 letras) e toque em <b>Buscar</b>.
                </p>
              ) : results.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-slate-50 py-6 text-center text-sm text-muted-foreground">
                  Nenhum local encontrado. Tente outro nome ou o órgão.
                </div>
              ) : (
                <ul className="space-y-2">
                  {results.map((l) => {
                    const url = origin
                      ? `${origin}/votacao/${l.linkToken}`
                      : `/votacao/${l.linkToken}`;
                    return (
                      <li
                        key={l.id}
                        className="flex items-center gap-2 rounded-xl border bg-background p-3"
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
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
