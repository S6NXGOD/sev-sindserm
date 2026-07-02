"use client";

import { useEffect, useState, useTransition } from "react";
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

const STATUS_OPTIONS = [
  { value: "open", label: "Abertas" },
  { value: "upcoming", label: "Não iniciadas" },
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

  // Debounce da busca textual.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => pushWith({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters =
    (searchParams.get("q") ?? "") !== "" ||
    zona !== ALL ||
    orgao !== ALL ||
    status !== ALL;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {isPending && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou slug..."
          className="pl-9"
        />
      </div>

      <div className="lg:w-56">
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
        <SelectTrigger className="lg:w-36">
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
        <SelectTrigger className="lg:w-40">
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
        <SelectTrigger className="lg:w-44">
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recentes">Mais recentes</SelectItem>
          <SelectItem value="antigos">Mais antigos</SelectItem>
          <SelectItem value="nome">Nome (A–Z)</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Preserva o ano (histórico) ao limpar os demais filtros.
            const ano = searchParams.get("ano");
            const url = ano ? `${basePath}?ano=${ano}` : basePath;
            startTransition(() => router.push(url));
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}
