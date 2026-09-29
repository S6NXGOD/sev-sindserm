"use client";

import { useEffect, useState } from "react";
import { ListChecks, Radio, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

export type AbaId = "resultados" | "ao-vivo" | "regras";

const ABAS: { id: AbaId; label: string; curto: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "resultados", label: "Resultados", curto: "Resultados", icon: ListChecks },
  { id: "ao-vivo", label: "Ao vivo", curto: "Ao vivo", icon: Radio },
  { id: "regras", label: "Regras & Auditoria", curto: "Regras", icon: ScrollText },
];

/**
 * Abas do portal público. Chave para o tour NÃO quebrar: os 3 painéis ficam
 * SEMPRE montados no DOM (o inativo só recebe `hidden`/display:none), então o
 * GuiaPortal acha os elementos com querySelector e, antes de medir, dispara o
 * evento 'sev:portal-tab' para ativar a aba dona do passo. Mobile-first: barra
 * de abas rolável e fixa no topo ao rolar.
 */
export function PortalTabs({
  resultados,
  aoVivo,
  regras,
}: {
  resultados: React.ReactNode;
  aoVivo: React.ReactNode;
  regras: React.ReactNode;
}) {
  const [aba, setAba] = useState<AbaId>("resultados");

  // Troca de aba disparada de fora (tour, "Ver esses locais" do aviso de
  // suplementar) via CustomEvent.
  useEffect(() => {
    const onTab = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d === "resultados" || d === "ao-vivo" || d === "regras") setAba(d);
    };
    window.addEventListener("sev:portal-tab", onTab);
    return () => window.removeEventListener("sev:portal-tab", onTab);
  }, []);

  const paineis: Record<AbaId, React.ReactNode> = {
    resultados,
    "ao-vivo": aoVivo,
    regras,
  };

  return (
    <div>
      <nav
        role="tablist"
        aria-label="Seções do portal"
        className="sticky top-0 z-20 mb-4 flex gap-1 overflow-x-auto rounded-xl border bg-white/95 p-1.5 shadow-sm backdrop-blur"
      >
        {ABAS.map((a) => {
          const Icon = a.icon;
          const ativo = aba === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              aria-controls={`painel-${a.id}`}
              onClick={() => setAba(a.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition",
                ativo
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{a.label}</span>
              <span className="sm:hidden">{a.curto}</span>
            </button>
          );
        })}
      </nav>

      {ABAS.map((a) => (
        <div
          key={a.id}
          role="tabpanel"
          id={`painel-${a.id}`}
          hidden={aba !== a.id}
          aria-hidden={aba !== a.id}
          className="space-y-6"
        >
          {paineis[a.id]}
        </div>
      ))}
    </div>
  );
}
