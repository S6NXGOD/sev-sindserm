"use client";

import { useEffect, useRef, useState } from "react";
import { MonitorPlay } from "lucide-react";
import type {
  DashboardData,
  MuralData,
  PresentationLocal,
} from "@/lib/dashboard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePresentationMode } from "./use-presentation-mode";
import { Celebration } from "./celebration";
import { PresentationTopBar } from "./presentation-top-bar";
import { PresentationTicker } from "./presentation-ticker";
import { SlideMonitor } from "./slide-monitor";
import { SlideMural } from "./slide-mural";

// Tempo de cada slide do carrossel (30–40s recomendados para o telão).
const SLIDE_INTERVAL = 35_000;

/**
 * Orquestrador do Modo Apresentação (telão):
 *  - Carrossel cíclico entre Slide 1 (Monitoramento) e Slide 2 (Mural dos Eleitos);
 *  - Interrupção "Plantão de Apuração" quando um local encerra (pausa o carrossel,
 *    dispara a comemoração por 15s e devolve o controle ao ciclo);
 *  - Componentes fixos: TopBar (KPIs + vagas neon) e Ticker de rodapé.
 * As views ficam em subcomponentes; animações são CSS (transform/opacity, GPU)
 * para o telão rodar horas sem travar.
 */
export function PresentationMode({
  data,
  locais,
  mural,
  trienio,
}: {
  data: DashboardData;
  locais: PresentationLocal[];
  mural: MuralData;
  trienio: string;
}) {
  const { active, toggle, playSuccess } = usePresentationMode();

  const [queue, setQueue] = useState<PresentationLocal[]>([]);
  const [current, setCurrent] = useState<PresentationLocal | null>(null);
  const [slide, setSlide] = useState(0);
  const prevStatus = useRef<Map<string, string> | null>(null);

  const temMural = mural.totalEleitos > 0;

  // Detecta locais que ENCERRARAM desde o último refresh (gatilho do Plantão).
  useEffect(() => {
    const curr = new Map(locais.map((l) => [l.id, l.status]));
    if (prevStatus.current === null) {
      prevStatus.current = curr;
      return;
    }
    if (active) {
      const fechados: PresentationLocal[] = [];
      for (const l of locais) {
        const antes = prevStatus.current.get(l.id);
        if (antes && antes !== "closed" && l.status === "closed") {
          fechados.push(l);
        }
      }
      if (fechados.length) setQueue((q) => [...q, ...fechados]);
    }
    prevStatus.current = curr;
  }, [locais, active]);

  // Fila de comemorações: uma de cada vez.
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, current]);

  // Ao desativar, interrompe tudo e volta ao primeiro slide.
  useEffect(() => {
    if (!active) {
      setCurrent(null);
      setQueue([]);
      setSlide(0);
    }
  }, [active]);

  // Carrossel: alterna a cada SLIDE_INTERVAL. PAUSA durante a comemoração
  // (current != null) — o Plantão interrompe o ciclo e depois o retoma.
  useEffect(() => {
    if (!active || current) return;
    const id = setInterval(() => {
      setSlide((s) => (s === 0 && temMural ? 1 : 0));
    }, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [active, current, temMural]);

  // Sem eleitos ainda → mantém o Slide 1 (não cicla para um Mural vazio).
  useEffect(() => {
    if (!temMural && slide !== 0) setSlide(0);
  }, [temMural, slide]);

  return (
    <>
      {/* Interruptor (fica no cabeçalho do dashboard) */}
      <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5">
        <MonitorPlay className="h-4 w-4 text-primary" />
        <Label htmlFor="modo-apresentacao" className="cursor-pointer text-sm">
          Modo Apresentação
        </Label>
        <Switch
          id="modo-apresentacao"
          checked={active}
          onCheckedChange={() => toggle()}
        />
      </div>

      {active && (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-slate-950 text-white">
          <PresentationTopBar
            data={data}
            mural={mural}
            trienio={trienio}
            onExit={() => toggle()}
          />

          {/* Carrossel de slides (key força a transição de entrada). */}
          <main className="relative min-h-0 flex-1 px-8 py-4">
            <div key={slide} className="h-full min-h-0">
              {slide === 0 ? (
                <SlideMonitor locais={locais} />
              ) : (
                <SlideMural mural={mural} />
              )}
            </div>
          </main>

          <PresentationTicker eleitos={mural.ultimos} />
        </div>
      )}

      {/* Plantão de Apuração — interrompe o carrossel por 15s. */}
      {active && current && (
        <Celebration
          local={current}
          onClose={() => setCurrent(null)}
          playSound={playSuccess}
        />
      )}
    </>
  );
}
