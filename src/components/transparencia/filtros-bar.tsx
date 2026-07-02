"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Barra de filtros do portal: texto livre (local/órgão), órgão e status. Cada
 * mudança atualiza a URL (preservando o ?pleito), e o Server Component recarrega.
 */
export function FiltrosBar({ orgaos }: { orgaos: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const pleito = searchParams.get("pleito") ?? "";
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const orgao = searchParams.get("orgao") ?? "";
  const status = searchParams.get("status") ?? "";

  // Aplica filtros mantendo o pleito atual.
  function aplicar(next: { q?: string; orgao?: string; status?: string }) {
    const params = new URLSearchParams();
    if (pleito) params.set("pleito", pleito);
    const nq = next.q ?? q;
    const no = next.orgao ?? orgao;
    const ns = next.status ?? status;
    if (nq.trim()) params.set("q", nq.trim());
    if (no) params.set("orgao", no);
    if (ns) params.set("status", ns);
    startTransition(() =>
      router.push(`/transparencia?${params.toString()}`, { scroll: false }),
    );
  }

  // Debounce do texto livre.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const atual = searchParams.get("q") ?? "";
    if (q === atual) return;
    const t = setTimeout(() => aplicar({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <div className="space-y-1">
        <Label htmlFor="busca" className="text-xs font-semibold uppercase text-muted-foreground">
          Buscar local ou órgão
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          <Input
            id="busca"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: Escola, UBS, SEMEC…"
            className="h-11 pl-9"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Órgão
        </Label>
        <div className="sm:w-[220px]">
          <Combobox
            value={orgao}
            onChange={(v) => aplicar({ orgao: v })}
            options={orgaos.map((o) => ({ value: o, label: o }))}
            placeholder="Todos os órgãos"
            searchPlaceholder="Buscar órgão..."
            clearLabel="Todos os órgãos"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Status
        </Label>
        <Select
          value={status || "todos"}
          onValueChange={(v) => aplicar({ status: v === "todos" ? "" : v })}
        >
          <SelectTrigger className="h-11 sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="open">Votação em Andamento</SelectItem>
            <SelectItem value="closed">Votação Encerrada</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
