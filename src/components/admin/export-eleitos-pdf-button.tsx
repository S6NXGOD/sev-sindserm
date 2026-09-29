"use client";

import { useState } from "react";
import { Award, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchEleitosPdfData } from "@/lib/actions/admin";
import { downloadEleitosPdf } from "@/lib/eleitos-pdf";
import { Button } from "@/components/ui/button";

/**
 * Baixa a LISTA OFICIAL DOS ELEITOS em PDF limpo (locais encerrados do pleito).
 */
export function ExportEleitosPdfButton({ ano }: { ano: number }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const data = await fetchEleitosPdfData(ano);
      if (!data || data.rows.length === 0) {
        toast.warning("Ainda não há eleitos definidos.");
        return;
      }
      await downloadEleitosPdf(data.rows, {
        logoSindserm: data.logoSindserm,
        logoPleito: data.logoPleito,
        titulo: data.titulo,
        geradoEm: new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Sao_Paulo",
        }).format(new Date()),
      });
      toast.success("Lista de eleitos gerada (PDF).");
    } catch {
      toast.error("Não foi possível gerar o PDF de eleitos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Award className="mr-2 h-4 w-4" />
      )}
      Lista de Eleitos (PDF)
    </Button>
  );
}
