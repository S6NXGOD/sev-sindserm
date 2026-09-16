"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";
import type { ReportData } from "@/lib/reports";
import type { ApuracaoPdfHeader } from "@/lib/apuracao-report-pdf";
import { downloadRelatorioPendencias } from "@/lib/pendencias-pdf";
import { Button } from "@/components/ui/button";

/**
 * Botão "Relatório de pendências (PDF)" — gera, no cliente, o documento de apoio
 * à decisão da diretoria: empates, encerrados sem votação, sem eleito e vaga
 * parcial, cada um com a ação recomendada.
 */
export function RelatorioPendenciasButton({
  data,
  header,
}: {
  data: ReportData;
  header: ApuracaoPdfHeader;
}) {
  const [loading, setLoading] = useState(false);

  async function gerar() {
    setLoading(true);
    try {
      await downloadRelatorioPendencias(data, header);
      toast.success("Relatório de pendências gerado.");
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={gerar}
      disabled={loading}
      className="w-full sm:w-auto"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ClipboardList className="mr-2 h-4 w-4" />
      )}
      Relatório de pendências (PDF)
    </Button>
  );
}
