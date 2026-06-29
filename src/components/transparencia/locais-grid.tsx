"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import type { TransparenciaLocal } from "@/lib/transparencia";
import type { PdfPleito } from "@/lib/transparencia-pdf";
import { Button } from "@/components/ui/button";
import { LocalCard } from "./local-card";

const PAGE = 24; // locais por página (cards colapsados → DOM leve no celular).

/**
 * Grade de locais (mobile-first) com paginação client-side ("Ver mais locais")
 * para não renderizar centenas de cards de uma vez.
 */
export function LocaisGrid({
  locais,
  pleito,
}: {
  locais: TransparenciaLocal[];
  pleito: PdfPleito;
}) {
  const [shown, setShown] = useState(PAGE);

  // Reset ao mudar de pleito/filtro (a lista muda de identidade).
  useEffect(() => {
    setShown(PAGE);
  }, [locais]);

  if (locais.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 py-16 text-center text-muted-foreground">
        <Building2 className="h-8 w-8" />
        <p>Nenhum local encontrado para os filtros selecionados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {locais.length} local(is) encontrado(s)
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {locais.slice(0, shown).map((l) => (
          <LocalCard key={l.id} local={l} pleito={pleito} />
        ))}
      </div>
      {shown < locais.length && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setShown((n) => n + PAGE)}
            className="min-w-[220px]"
          >
            Ver mais locais (+{locais.length - shown})
          </Button>
        </div>
      )}
    </div>
  );
}
