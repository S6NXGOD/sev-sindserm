"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { fetchRitmoSeries } from "@/lib/actions/dashboard-actions";
import type { RitmoPonto, RitmoRange } from "@/lib/dashboard";
import { RitmoChart } from "@/components/admin/ritmo-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RANGES: { value: RitmoRange; label: string }[] = [
  { value: "1h", label: "Última 1 hora" },
  { value: "12h", label: "Últimas 12 horas" },
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "mes", label: "Últimos 30 dias" },
  { value: "custom", label: "Personalizado" },
];

const LABELS: Record<RitmoRange, string> = {
  "1h": "última hora",
  "12h": "últimas 12 horas",
  hoje: "hoje",
  ontem: "ontem",
  "7d": "últimos 7 dias",
  mes: "últimos 30 dias",
  custom: "período personalizado",
};

/**
 * Gráfico de Ritmo com intervalo SELECIONÁVEL. "Hoje" e os intervalos curtos
 * acompanham o tempo real (re-buscam quando o dashboard atualiza); o
 * "Personalizado" só recarrega ao clicar em Aplicar.
 */
export function RitmoCard({
  ano,
  inicial,
}: {
  ano: number;
  inicial: RitmoPonto[];
}) {
  const [range, setRange] = useState<RitmoRange>("hoje");
  const [data, setData] = useState<RitmoPonto[]>(inicial);
  const [ci, setCi] = useState("");
  const [cf, setCf] = useState("");
  const [pending, startTransition] = useTransition();
  const rangeRef = useRef<RitmoRange>("hoje");
  rangeRef.current = range;

  function load(r: RitmoRange, a?: string, b?: string) {
    startTransition(async () => {
      const res = await fetchRitmoSeries(ano, r, a, b);
      setData(res);
    });
  }

  // Mantém vivo conforme o dashboard atualiza (router.refresh muda `inicial`):
  // "hoje" usa direto a série do servidor; demais intervalos (exceto custom)
  // re-buscam. "custom" fica congelado até o usuário aplicar de novo.
  useEffect(() => {
    const r = rangeRef.current;
    if (r === "hoje") setData(inicial);
    else if (r !== "custom") load(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  function onRange(v: string) {
    const r = v as RitmoRange;
    setRange(r);
    if (r === "hoje") setData(inicial);
    else if (r !== "custom") load(r);
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5" />
            Ritmo da votação
          </CardTitle>
          <Select value={range} onValueChange={onRange}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CardDescription>
          Votos por {range === "7d" || range === "mes" ? "dia" : "hora"} —{" "}
          {LABELS[range]} (horário de Brasília).
        </CardDescription>
        {range === "custom" && (
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <div className="space-y-1">
              <Label htmlFor="ritmo-ci" className="text-xs">
                Início
              </Label>
              <Input
                id="ritmo-ci"
                type="datetime-local"
                value={ci}
                onChange={(e) => setCi(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ritmo-cf" className="text-xs">
                Fim
              </Label>
              <Input
                id="ritmo-cf"
                type="datetime-local"
                value={cf}
                onChange={(e) => setCf(e.target.value)}
                className="h-8"
              />
            </div>
            <Button
              size="sm"
              onClick={() => load("custom", ci || undefined, cf || undefined)}
              disabled={pending}
            >
              Aplicar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {pending ? (
          <div className="flex h-[220px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando…
          </div>
        ) : (
          <RitmoChart data={data} />
        )}
      </CardContent>
    </Card>
  );
}
