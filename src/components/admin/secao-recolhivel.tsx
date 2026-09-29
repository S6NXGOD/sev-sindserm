"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Seção recolhível para enxugar o dashboard. É CLIENT com useState de propósito:
 * a dashboard roda em "Tempo Real" (AutoRefresh dá router.refresh() a cada 15s),
 * que re-renderiza os Server Components SEM desmontar os client components — então
 * o estado aberto/fechado SOBREVIVE ao refresh (o inicializador do useState só lê
 * `defaultOpen` na montagem). Um <details open={live}> nativo seria reaplicado pelo
 * React e fecharia sozinho a cada 15s.
 */
export function SecaoRecolhivel({
  titulo,
  descricao,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  titulo: string;
  descricao?: string;
  /** Ícone JÁ RENDERIZADO (ReactNode) — NÃO um componente. Passar uma função
      (ex.: icon={Users}) de Server p/ Client Component quebra a serialização RSC. */
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 sm:p-5"
      >
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight sm:text-base">{titulo}</p>
          {descricao && (
            <p className="text-xs leading-tight text-muted-foreground">{descricao}</p>
          )}
        </div>
        {badge != null && <span className="shrink-0">{badge}</span>}
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>
      {aberto && <div className="border-t p-4 sm:p-5">{children}</div>}
    </Card>
  );
}
