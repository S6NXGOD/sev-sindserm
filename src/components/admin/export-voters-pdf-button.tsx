"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchVotersForPdf } from "@/lib/actions/admin";
import { downloadVotersPdf } from "@/lib/voters-pdf";
import { Button } from "@/components/ui/button";

function descreverFiltro(sp: URLSearchParams): string {
  const partes: string[] = [];
  const fil = sp.get("filiacao");
  if (fil === "sim") partes.push("Somente filiados");
  else if (fil === "nao") partes.push("Somente não filiados");
  if (sp.get("zona")) partes.push(`Zona ${sp.get("zona")}`);
  if (sp.get("orgao")) partes.push(`Órgão ${sp.get("orgao")}`);
  if (sp.get("localId")) partes.push("Local específico");
  if (sp.get("q")) partes.push(`Busca “${sp.get("q")}”`);
  return partes.length ? partes.join(" · ") : "Todos os votantes";
}

export function ExportVotersPdfButton({
  ano,
  logoSindserm,
  logoPleito,
  tituloPleito,
}: {
  ano: number;
  logoSindserm: string;
  logoPleito: string | null;
  tituloPleito: string;
}) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const data = await fetchVotersForPdf({
        anoEleicao: ano,
        q: searchParams.get("q") ?? undefined,
        zona: searchParams.get("zona") ?? undefined,
        orgao: searchParams.get("orgao") ?? undefined,
        localId: searchParams.get("localId") ?? undefined,
        filiacao: searchParams.get("filiacao") ?? undefined,
      });

      if (data.rows.length === 0) {
        toast.warning("Nenhum votante nos filtros atuais.");
        return;
      }

      await downloadVotersPdf(
        data.rows,
        { total: data.total, filiados: data.filiados },
        {
          logoSindserm,
          logoPleito,
          tituloPleito,
          subtitulo: "Lista de Votantes",
          filtro: descreverFiltro(searchParams),
          geradoEm: new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "America/Sao_Paulo",
          }).format(new Date()),
        },
      );
      toast.success("PDF gerado com os filtros atuais.");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
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
        <FileText className="mr-2 h-4 w-4" />
      )}
      Exportar PDF
    </Button>
  );
}
