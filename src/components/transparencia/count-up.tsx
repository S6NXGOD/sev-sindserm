"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que "sobe" suavemente até o valor (KPIs). Anima do valor ANTERIOR para
 * o novo (não reinicia do zero a cada auto-refresh) e respeita reduced-motion.
 */
export function CountUp({
  value,
  duration = 550,
}: {
  value: number;
  duration?: number;
}) {
  const [n, setN] = useState(value);
  const fromRef = useRef(0); // 1ª montagem sobe de 0

  useEffect(() => {
    let reduzir = false;
    try {
      reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* ignora */
    }
    const from = fromRef.current;
    if (reduzir || from === value) {
      setN(value);
      fromRef.current = value;
      return;
    }
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setN(Math.round(from + (value - from) * ease(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{n.toLocaleString("pt-BR")}</>;
}
