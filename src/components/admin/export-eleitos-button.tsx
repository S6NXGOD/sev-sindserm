"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Award, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportEleitosCsv } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

/**
 * Baixa o RELATÓRIO DEFINITIVO DE ELEITOS (CSV) — locais ENCERRADOS do pleito,
 * respeitando os filtros atuais da tela (órgão/local).
 */
export function ExportEleitosButton({ ano }: { ano: number }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const csv = await exportEleitosCsv({
        anoEleicao: ano,
        orgao: searchParams.get("orgao") ?? undefined,
        localId: searchParams.get("localId") ?? undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eleitos-${ano}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Relatório de eleitos exportado (locais encerrados).");
    } catch {
      toast.error("Não foi possível gerar o relatório de eleitos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Award className="mr-2 h-4 w-4" />
      )}
      Relatório de Eleitos (CSV)
    </Button>
  );
}
