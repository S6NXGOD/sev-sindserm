"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { playSuccessSound, primeSuccessSound } from "@/lib/sound";

/**
 * Toca o success.mp3 quando o nº de locais ENCERRADOS aumenta (novo resultado
 * consolidado). Opcionalmente mantém a página "ao vivo" com auto-refresh.
 * Destrava o áudio no primeiro gesto do usuário (autoplay policy).
 */
export function NovoResultadoSom({
  encerradas,
  autoRefreshMs,
}: {
  encerradas: number;
  autoRefreshMs?: number;
}) {
  const prev = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (prev.current !== null && encerradas > prev.current) {
      playSuccessSound();
    }
    prev.current = encerradas;
  }, [encerradas]);

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
