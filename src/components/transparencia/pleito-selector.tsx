"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Vote } from "lucide-react";
import type { PleitoOption } from "@/lib/transparencia";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Seletor GLOBAL de pleito. Trocar o pleito recarrega os dados/gráficos/logos
 * (navega para ?pleito=ID, limpando os filtros do pleito anterior).
 */
export function PleitoSelector({
  pleitos,
  selected,
}: {
  pleitos: PleitoOption[];
  selected: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function trocar(id: string) {
    startTransition(() => router.push(`/transparencia?pleito=${id}`));
  }

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-sm font-bold text-primary">
        <Vote className="h-4 w-4" />
        Escolha a eleição que deseja acompanhar
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      </Label>
      <Select value={selected} onValueChange={trocar}>
        <SelectTrigger className="h-12 w-full bg-white text-base font-medium shadow-sm">
          <SelectValue placeholder="Selecione um pleito" />
        </SelectTrigger>
        <SelectContent>
          {pleitos.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
              {p.ativo ? " · Vigente" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Troque aqui para ver os dados de outra eleição/pleito.
      </p>
    </div>
  );
}
