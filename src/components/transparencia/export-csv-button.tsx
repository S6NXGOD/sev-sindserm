"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchEleitosCsv } from "@/lib/actions/transparencia";
import { Button } from "@/components/ui/button";

/**
 * Baixa o relatório geral do pleito (CSV consolidado com todos os eleitos).
 * Gera no servidor (Server Action) e dispara o download no cliente via Blob.
 */
export function ExportCsvButton({ electionId }: { electionId: string }) {
  const [loading, setLoading] = useState(false);

  async function baixar() {
    setLoading(true);
    try {
      const res = await fetchEleitosCsv(electionId);
      if (!res || res.csv.trim().split("\n").length <= 1) {
        toast.info("Ainda não há eleitos consolidados neste pleito.");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={baixar} disabled={loading} variant="secondary">
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Baixar Relatório Geral (CSV)
    </Button>
  );
}
