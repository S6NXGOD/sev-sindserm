"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Lista com animação FLIP: quando os itens trocam de ordem (ex.: um candidato
 * ultrapassa o outro em votos), as linhas deslizam suavemente para a nova
 * posição. Cada item é identificado por `getKey` para rastrear a posição.
 */
export function FlipList<T>({
  items,
  getKey,
  children,
  className,
  itemClassName,
}: {
  items: T[];
  getKey: (item: T) => string;
  children: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const positions = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>("[data-flip-key]"),
    );
    const novas = new Map<string, number>();

    for (const node of nodes) {
      const key = node.dataset.flipKey as string;
      const top = node.offsetTop;
      novas.set(key, top);
      const anterior = positions.current.get(key);
      if (anterior !== undefined && anterior !== top) {
        const delta = anterior - top;
        node.style.transition = "none";
        node.style.transform = `translateY(${delta}px)`;
        // força reflow para aplicar o transform inicial sem animação
        void node.getBoundingClientRect();
        requestAnimationFrame(() => {
          node.style.transition = "transform 650ms cubic-bezier(0.22,1,0.36,1)";
          node.style.transform = "";
        });
      }
    }
    positions.current = novas;
  });

  return (
    <div ref={containerRef} className={className} style={{ position: "relative" }}>
      {items.map((item, i) => (
        <div
          key={getKey(item)}
          data-flip-key={getKey(item)}
          className={itemClassName}
          style={{ willChange: "transform" }}
        >
          {children(item, i)}
        </div>
      ))}
    </div>
  );
}
