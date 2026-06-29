"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Atualização em tempo real do dashboard. Quando ligado, chama router.refresh()
 * periodicamente (re-executa os Server Components com dados atualizados).
 */
export function AutoRefresh({
  geradoEm,
  intervalSeconds = 15,
  nextCloseAt = null,
}: {
  geradoEm: string;
  intervalSeconds?: number;
  /** ISO do próximo encerramento — agenda um refresh exato nesse instante. */
  nextCloseAt?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      startTransition(() => router.refresh());
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [auto, intervalSeconds, router]);

  // Refresh AUTOMÁTICO no instante exato do próximo encerramento (independe do
  // "tempo real"): dispara o dashboard E o Modo Apresentação (som + comemoração)
  // na hora certa, sem esperar o próximo tick do intervalo.
  useEffect(() => {
    if (!nextCloseAt) return;
    const ms = new Date(nextCloseAt).getTime() - Date.now() + 1200; // +buffer
    if (ms <= 0) {
      startTransition(() => router.refresh());
      return;
    }
    // setTimeout tem teto de ~24.8 dias; aqui sempre cabe (encerramentos < 24h).
    const id = setTimeout(() => {
      startTransition(() => router.refresh());
    }, ms);
    return () => clearTimeout(id);
  }, [nextCloseAt, router]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs text-muted-foreground">
        Atualizado às {geradoEm}
      </span>
      <div className="flex items-center gap-2">
        <Checkbox
          id="auto-refresh"
          checked={auto}
          onCheckedChange={(c) => setAuto(Boolean(c))}
        />
        <Label htmlFor="auto-refresh" className="font-normal text-xs">
          Tempo real ({intervalSeconds}s)
        </Label>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
      >
        <RefreshCw
          className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`}
        />
        Atualizar
      </Button>
    </div>
  );
}
