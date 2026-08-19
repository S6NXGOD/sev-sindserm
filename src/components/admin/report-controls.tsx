"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { ORGAOS, ZONAS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
const ORGAO_OPTIONS = ORGAOS.map((o) => ({ value: o, label: o }));

const TIPOS = [
  { value: "geral", label: "Geral (todos os locais)" },
  { value: "orgao", label: "Por órgão" },
  { value: "zona", label: "Por zona" },
  { value: "local", label: "Por local de trabalho" },
  { value: "encerradas", label: "Votações encerradas" },
];

export function ReportControls({
  ano,
  selectedLocalNome,
}: {
  ano: number;
  /** Nome do local selecionado (resolvido no servidor) para o autocomplete. */
  selectedLocalNome: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tipo = searchParams.get("tipo") ?? "geral";
  const orgao = searchParams.get("orgao") ?? "";
  const zona = searchParams.get("zona") ?? "";
  const localId = searchParams.get("localId") ?? "";

  const [localLabel, setLocalLabel] = useState(selectedLocalNome);
  useEffect(() => setLocalLabel(selectedLocalNome), [selectedLocalNome]);

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
          <Combobox
            value={orgao}
            onChange={(v) => go({ tipo: "orgao", orgao: v })}
            options={ORGAO_OPTIONS}
            placeholder="Todos os órgãos"
            searchPlaceholder="Buscar órgão..."
            clearLabel="Todos os órgãos"
          />
        </div>
      )}

      {tipo === "zona" && (
        <div className="space-y-1.5 lg:w-56">
          <Label className="text-xs">Zona</Label>
          <Select
            value={zona || ALL}
            onValueChange={(v) => go({ tipo: "zona", zona: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as zonas" />
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
        </div>
      )}

      {tipo === "local" && (
        <div className="space-y-1.5 lg:w-80">
          <Label className="text-xs">Local de trabalho</Label>
          <WorkplaceCombobox
            ano={ano}
            value={localId}
            valueLabel={localLabel}
            placeholder="Selecione um local"
            clearLabel="Limpar seleção"
            onSelect={(id, label) => {
              setLocalLabel(label);
              go({ tipo: "local", localId: id });
            }}
          />
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
