"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { playSuccessSound, primeSuccessSound } from "@/lib/sound";

/**
 * Anti-crash de encerramento em LOTE.
 *
 * Toca o success.mp3 e mostra um toast quando o nº de locais ENCERRADOS aumenta.
 * Se muitos encerrarem "de uma vez" (mesma virada de horário / rajada de
 * refreshes), os eventos são AGRUPADOS por um debounce: dispara UMA única vez
 * (um som + um toast "X eleições encerradas") — protegendo a aba de travar com
 * centenas de sons/toasts simultâneos.
 */
const AGRUPAR_MS = 900;

export function NovoResultadoSom({
  encerradas,
  autoRefreshMs,
}: {
  encerradas: number;
  autoRefreshMs?: number;
}) {
  const router = useRouter();
  const observado = useRef<number | null>(null); // último valor visto
  const baseNotificada = useRef<number>(0); // valor na última notificação
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 1º render: ancora a linha de base (nunca notifica no carregamento).
    if (observado.current === null) {
      observado.current = encerradas;
      baseNotificada.current = encerradas;
      return;
    }

    if (encerradas > observado.current) {
      observado.current = encerradas;
      // DEBOUNCE: cada novo aumento reinicia o timer; só dispara ao estabilizar,
      // coalescendo uma rajada inteira numa notificação só.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const delta = encerradas - baseNotificada.current;
        baseNotificada.current = encerradas;
        timer.current = null;
        if (delta <= 0) return;
        playSuccessSound(); // UMA vez, independentemente de quantas encerraram
        toast.success(
          delta === 1
            ? "1 eleição encerrada com sucesso"
            : `${delta.toLocaleString("pt-BR")} eleições encerradas com sucesso`,
        );
      }, AGRUPAR_MS);
    } else if (encerradas < observado.current) {
      // Diminuiu (troca de pleito/ano): reancora sem notificar.
      observado.current = encerradas;
      baseNotificada.current = encerradas;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    }
  }, [encerradas]);

  // Limpa timer pendente ao desmontar.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Destrava o áudio no primeiro gesto do usuário (política de autoplay).
  useEffect(() => {
    const h = () => primeSuccessSound();
    window.addEventListener("pointerdown", h, { once: true });
    window.addEventListener("keydown", h, { once: true });
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", h);
    };
  }, []);

  useEffect(() => {
    if (!autoRefreshMs) return;
    const id = setInterval(() => router.refresh(), autoRefreshMs);
    return () => clearInterval(id);
  }, [autoRefreshMs, router]);

  return null;
}
