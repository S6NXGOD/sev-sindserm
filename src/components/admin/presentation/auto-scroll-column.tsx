"use client";

import { useEffect, useRef } from "react";

/**
 * Rola o conteúdo VERTICALMENTE, sozinho, quando ele não cabe na área visível —
 * para o telão (Mural dos Eleitos) mostrar TODOS os eleitos, não só os que cabem
 * na primeira tela. Ciclo suave: pausa no topo → desce → pausa embaixo → volta.
 *
 * - Só anima quando há overflow (se cabe tudo, fica parado — nada de tremer).
 * - Usa `transform` (composição na GPU), sem `scrollTop`: fluido no telão.
 * - Respeita `prefers-reduced-motion` (acessibilidade).
 * - Recalcula a cada quadro, então lida com novos eleitos entrando ao vivo.
 */
export function AutoScrollColumn({
  children,
  className,
  /** Velocidade da descida, em px/s. */
  speed = 26,
  /** Pausa (ms) no topo e na base antes de inverter. */
  pauseMs = 1800,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  pauseMs?: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const semMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let raf = 0;
    let inicio = 0;

    const passo = (agora: number) => {
      if (!inicio) inicio = agora;

      // `transform` não altera o layout, então ler estas medidas é barato
      // (não força reflow) e acompanha mudanças de conteúdo/tamanho.
      const overflow = content.scrollHeight - viewport.clientHeight;

      if (overflow <= 4 || semMovimento) {
        content.style.transform = "translateY(0)";
        raf = requestAnimationFrame(passo);
        return;
      }

      const percurso = (overflow / speed) * 1000; // ms para descer tudo
      const ciclo = pauseMs * 2 + percurso * 2;
      const t = (agora - inicio) % ciclo;

      let y: number;
      if (t < pauseMs) {
        y = 0; // pausa no topo
      } else if (t < pauseMs + percurso) {
        y = ((t - pauseMs) / percurso) * overflow; // descendo
      } else if (t < pauseMs * 2 + percurso) {
        y = overflow; // pausa na base
      } else {
        y = (1 - (t - pauseMs * 2 - percurso) / percurso) * overflow; // subindo
      }

      content.style.transform = `translateY(${-y}px)`;
      raf = requestAnimationFrame(passo);
    };

    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [speed, pauseMs]);

  return (
    <div ref={viewportRef} className={`overflow-hidden ${className ?? ""}`}>
      <div ref={contentRef} className="will-change-transform">
        {children}
      </div>
    </div>
  );
}
