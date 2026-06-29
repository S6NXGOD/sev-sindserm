"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { ORGAOS, ZONAS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";
const BASE = "/admin/votantes";

export function VotersFilterBar({
  locais,
}: {
  locais: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const zona = searchParams.get("zona") ?? ALL;
  const orgao = searchParams.get("orgao") ?? ALL;
  const localId = searchParams.get("localId") ?? ALL;
  const filiacao = searchParams.get("filiacao") ?? ALL;

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  function pushWith(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === ALL) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    startTransition(() => router.push(`${BASE}?${params.toString()}`));
  }

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
    localId !== ALL ||
    filiacao !== ALL;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {isPending && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar votante por nome..."
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          value={filiacao}
          onValueChange={(v) => pushWith({ filiacao: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filiação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos (filiação)</SelectItem>
            <SelectItem value="sim">Filiados</SelectItem>
            <SelectItem value="nao">Não filiados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={localId} onValueChange={(v) => pushWith({ localId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Local de trabalho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os locais</SelectItem>
            {locais.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={zona} onValueChange={(v) => pushWith({ zona: v })}>
          <SelectTrigger>
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

        <Select value={orgao} onValueChange={(v) => pushWith({ orgao: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Órgão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os órgãos</SelectItem>
            {ORGAOS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const ano = searchParams.get("ano");
              startTransition(() =>
                router.push(ano ? `${BASE}?ano=${ano}` : BASE),
              );
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
