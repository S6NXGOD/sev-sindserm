"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportVotersCsv } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function ExportVotersButton({ ano }: { ano: number }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const csv = await exportVotersCsv({
        anoEleicao: ano,
        q: searchParams.get("q") ?? undefined,
        zona: searchParams.get("zona") ?? undefined,
        orgao: searchParams.get("orgao") ?? undefined,
        localId: searchParams.get("localId") ?? undefined,
        filiacao: searchParams.get("filiacao") ?? undefined,
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `votantes-${ano}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado com os filtros atuais.");
    } catch {
      toast.error("Não foi possível exportar o CSV.");
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
        <Download className="mr-2 h-4 w-4" />
      )}
      Exportar para CSV
    </Button>
  );
}
