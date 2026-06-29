"use client";

import { useEffect } from "react";

/**
 * Registra o Service Worker (/sw.js) — necessário para a instalação do PWA no
 * Android (Chrome). Não renderiza nada. Falhas são silenciosas (ex.: navegador
 * sem suporte ou ambiente sem HTTPS).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sem suporte / sem https: ignora silenciosamente */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
