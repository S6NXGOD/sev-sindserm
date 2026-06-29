"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "sev-presentation-mode";

/**
 * Gerencia o estado do Modo Apresentação (isPresentationMode).
 * Persiste em localStorage (sobrevive a reload do telão) e expõe um helper para
 * tocar o som de sucesso — destravando o áudio no gesto do clique do toggle.
 */
const SUCCESS_SRC = "/sounds/success.mp3";

export function usePresentationMode() {
  const [active, setActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    setActive(
      typeof window !== "undefined" &&
        window.localStorage.getItem(STORAGE_KEY) === "1",
    );
  }, []);

  // Destrava o áudio (autoplay policy): toca mudo e pausa dentro de um gesto.
  const primeAudio = useCallback(() => {
    if (unlockedRef.current || typeof Audio === "undefined") return;
    try {
      const a = audioRef.current ?? new Audio(SUCCESS_SRC);
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
          unlockedRef.current = true;
        })
        .catch(() => {});
      audioRef.current = a;
    } catch {
      /* ignore */
    }
  }, []);

  // Em RELOAD com o modo já ativo não há gesto: destrava no 1º clique/tecla.
  useEffect(() => {
    if (!active || unlockedRef.current) return;
    const handler = () => primeAudio();
    const opts = { once: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", handler, opts);
    window.addEventListener("keydown", handler, opts);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [active, primeAudio]);

  const persist = useCallback((value: boolean) => {
    setActive(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !active;
    if (next) primeAudio(); // estamos no gesto do clique → destrava o som
    persist(next);
  }, [active, persist, primeAudio]);

  const playSuccess = useCallback(() => {
    try {
      const a = audioRef.current ?? new Audio(SUCCESS_SRC);
      audioRef.current = a;
      a.muted = false;
      a.volume = 1;
      a.currentTime = 0;
      void a.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }, []);

  return { active, toggle, setActive: persist, playSuccess };
}
