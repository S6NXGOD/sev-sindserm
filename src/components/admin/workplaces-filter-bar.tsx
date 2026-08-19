"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { ORGAOS, ZONAS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";
const ORGAO_OPTIONS = ORGAOS.map((o) => ({ value: o, label: o }));

// 4 status mutuamente exclusivos (ver src/lib/voting-status.ts).
const STATUS_OPTIONS = [
  { value: "undefined", label: "Aguardando agendamento" },
  { value: "upcoming", label: "Não iniciadas (agendadas)" },
  { value: "open", label: "Abertas" },
  { value: "closed", label: "Encerradas" },
];

export function WorkplacesFilterBar({
  basePath = "/admin/locais",
}: {
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const zona = searchParams.get("zona") ?? ALL;
  const orgao = searchParams.get("orgao") ?? ALL;
  const status = searchParams.get("status") ?? ALL;
  const sort = searchParams.get("sort") ?? "recentes";

  // Mantém o input sincronizado quando a URL muda externamente (ex.: "Limpar").
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  function pushWith(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === ALL) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page"); // qualquer filtro volta para a página 1
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  }

  // A busca textual só dispara ao ENVIAR (Enter ou botão "Buscar") — nunca a
  // cada tecla. No mobile, fecha o teclado para não cobrir os resultados.
  function submitBusca(e?: React.FormEvent) {
    e?.preventDefault();
    inputRef.current?.blur();
    pushWith({ q: q.trim() });
  }

  const hasFilters =
    (searchParams.get("q") ?? "") !== "" ||
    zona !== ALL ||
    orgao !== ALL ||
    status !== ALL;

  return (
    <div className="space-y-3">
      {/* Busca: campo + botão. Mobile-first — só consulta ao tocar "Buscar". */}
      <form onSubmit={submitBusca} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, órgão ou slug..."
            className="h-11 pl-9"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Buscar locais"
          />
        </div>
        <Button type="submit" disabled={isPending} className="h-11 shrink-0">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
          ) : (
            <Search className="h-4 w-4 sm:mr-2" />
          )}
          <span className="hidden sm:inline">Buscar</span>
        </Button>
      </form>

      {/* Filtros — grade de 2 colunas no mobile, linha única no desktop. */}
      <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
        <div className="col-span-2 lg:w-56">
          <Combobox
            value={orgao === ALL ? "" : orgao}
            onChange={(v) => pushWith({ orgao: v })}
            options={ORGAO_OPTIONS}
            placeholder="Órgão"
            searchPlaceholder="Buscar órgão..."
            clearLabel="Todos os órgãos"
          />
        </div>

        <Select value={zona} onValueChange={(v) => pushWith({ zona: v })}>
          <SelectTrigger className="h-11 lg:h-10 lg:w-36">
            <SelectValue placeholder="Zona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as zonas</SelectItem>
            {ZONAS.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => pushWith({ status: v })}>
          <SelectTrigger className="h-11 lg:h-10 lg:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Ordenação — padrão "Mais recentes" (recém-criados no topo). */}
        <Select
          value={sort}
          onValueChange={(v) => pushWith({ sort: v === "recentes" ? "" : v })}
        >
          <SelectTrigger className="col-span-2 h-11 lg:h-10 lg:w-52">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fim_desc">Encerramento recente</SelectItem>
            <SelectItem value="inicio_desc">Abertura recente</SelectItem>
            <SelectItem value="votos">Mais votados</SelectItem>
            <SelectItem value="recentes">Cadastro recente</SelectItem>
            <SelectItem value="antigos">Cadastro antigo</SelectItem>
            <SelectItem value="nome">Nome (A–Z)</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="col-span-2 lg:w-auto"
            onClick={() => {
              // Preserva o ano (histórico) ao limpar os demais filtros.
              const ano = searchParams.get("ano");
              const url = ano ? `${basePath}?ano=${ano}` : basePath;
              setQ("");
              startTransition(() => router.push(url));
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
