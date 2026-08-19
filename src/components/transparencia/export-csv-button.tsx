"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchEleitosCsv, fetchEleitosRows } from "@/lib/actions/transparencia";
import { downloadRelatorioGeralPdf, type PdfPleito } from "@/lib/transparencia-pdf";
import { Button } from "@/components/ui/button";

/**
 * Baixa o relatório geral do pleito (todos os eleitos titulares dos locais
 * encerrados) em CSV ou PDF. Ambos geram no servidor/cliente e disparam o
 * download via Blob. Layout com wrap — nunca "quebra" em telas estreitas.
 */
export function ExportButtons({
  electionId,
  pleito,
}: {
  electionId: string;
  pleito: PdfPleito;
}) {
  const [loading, setLoading] = useState<"csv" | "pdf" | null>(null);

  async function baixarCsv() {
    setLoading("csv");
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
      toast.error("Não foi possível gerar o CSV.");
    } finally {
      setLoading(null);
    }
  }

  async function baixarPdf() {
    setLoading("pdf");
    try {
      const data = await fetchEleitosRows(electionId);
      if (!data || data.rows.length === 0) {
        toast.info("Ainda não há eleitos consolidados neste pleito.");
        return;
      }
      await downloadRelatorioGeralPdf(data, pleito);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-muted-foreground">
        Relatório Geral:
      </span>
      <Button
        onClick={baixarCsv}
        disabled={loading !== null}
        variant="secondary"
        size="sm"
      >
        {loading === "csv" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        CSV
      </Button>
      <Button
        onClick={baixarPdf}
        disabled={loading !== null}
        variant="secondary"
        size="sm"
      >
        {loading === "pdf" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        PDF
      </Button>
    </div>
  );
}
