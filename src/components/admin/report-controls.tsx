"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { ORGAOS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

const TIPOS = [
  { value: "geral", label: "Geral (todos os locais)" },
  { value: "orgao", label: "Por órgão" },
  { value: "local", label: "Por local de trabalho" },
  { value: "encerradas", label: "Votações encerradas" },
];

export function ReportControls({
  locais,
  ano,
}: {
  locais: { id: string; nome: string }[];
  ano: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tipo = searchParams.get("tipo") ?? "geral";
  const orgao = searchParams.get("orgao") ?? ALL;
  const localId = searchParams.get("localId") ?? "";

  function go(params: Record<string, string>) {
    const sp = new URLSearchParams();
    sp.set("ano", String(ano)); // mantém o ano selecionado
    for (const [k, v] of Object.entries(params)) {
      if (v && v !== ALL) sp.set(k, v);
    }
    router.push(`/admin/relatorios?${sp.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 print:hidden lg:flex-row lg:items-end">
      <div className="space-y-1.5 lg:w-72">
        <Label className="text-xs">Tipo de relatório</Label>
        <Select value={tipo} onValueChange={(v) => go({ tipo: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tipo === "orgao" && (
        <div className="space-y-1.5 lg:w-80">
          <Label className="text-xs">Órgão</Label>
          <Select
            value={orgao}
            onValueChange={(v) => go({ tipo: "orgao", orgao: v })}
          >
            <SelectTrigger>
              <SelectValue />
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
      )}

      {tipo === "local" && (
        <div className="space-y-1.5 lg:w-80">
          <Label className="text-xs">Local de trabalho</Label>
          <Select
            value={localId}
            onValueChange={(v) => go({ tipo: "local", localId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um local" />
            </SelectTrigger>
            <SelectContent>
              {locais.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="lg:ml-auto">
        <Button type="button" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir / Salvar PDF
        </Button>
      </div>
    </div>
  );
}
