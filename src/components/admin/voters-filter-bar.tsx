"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { ORGAOS, ZONAS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { WorkplaceCombobox } from "@/components/admin/workplace-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";
const BASE = "/admin/votantes";
const ORGAO_OPTIONS = ORGAOS.map((o) => ({ value: o, label: o }));

export function VotersFilterBar({
  ano,
  selectedLocalNome,
}: {
  ano: number;
  /** Nome do local selecionado (resolvido no servidor) para o autocomplete. */
  selectedLocalNome: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const zona = searchParams.get("zona") ?? ALL;
  const orgao = searchParams.get("orgao") ?? "";
  const localId = searchParams.get("localId") ?? "";
  const filiacao = searchParams.get("filiacao") ?? ALL;

  // Rótulo do local mostrado no botão (imediato ao selecionar; ressincroniza
  // quando a navegação conclui e o servidor devolve o nome atualizado).
  const [localLabel, setLocalLabel] = useState(selectedLocalNome);
  useEffect(() => setLocalLabel(selectedLocalNome), [selectedLocalNome]);

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
    orgao !== "" ||
    localId !== "" ||
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
        <Select value={filiacao} onValueChange={(v) => pushWith({ filiacao: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Filiação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos (filiação)</SelectItem>
            <SelectItem value="sim">Filiados</SelectItem>
            <SelectItem value="nao">Não filiados</SelectItem>
          </SelectContent>
        </Select>

        {/* Autocomplete de local (busca no servidor, resultados limitados). */}
        <WorkplaceCombobox
          ano={ano}
          value={localId}
          valueLabel={localLabel}
          onSelect={(id, label) => {
            setLocalLabel(label);
            pushWith({ localId: id });
          }}
        />

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

        {/* Autocomplete de órgão (busca digitando na lista). */}
        <Combobox
          value={orgao}
          onChange={(v) => pushWith({ orgao: v })}
          options={ORGAO_OPTIONS}
          placeholder="Todos os órgãos"
          searchPlaceholder="Buscar órgão..."
          clearLabel="Todos os órgãos"
        />
      </div>

      {hasFilters && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const anoParam = searchParams.get("ano");
              startTransition(() =>
                router.push(anoParam ? `${BASE}?ano=${anoParam}` : BASE),
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
