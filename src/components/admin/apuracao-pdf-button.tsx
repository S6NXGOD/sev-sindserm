"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import type { ReportData } from "@/lib/reports";
import {
  downloadApuracaoReportPdf,
  type ApuracaoPdfHeader,
} from "@/lib/apuracao-report-pdf";
import { Button } from "@/components/ui/button";

/**
 * Botão "Baixar PDF" do relatório de apuração. Recebe os dados JÁ carregados no
 * servidor (ReportData, serializável) + o cabeçalho, e gera o PDF consolidado
 * no cliente respeitando o critério escolhido.
 */
export function ApuracaoPdfButton({
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
      await downloadApuracaoReportPdf(data, header);
      toast.success("PDF gerado com o critério selecionado.");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" onClick={gerar} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-2 h-4 w-4" />
      )}
      Baixar PDF
    </Button>
  );
}
