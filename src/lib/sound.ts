// Reprodução do som de sucesso (público): usado no Modo Apresentação, no
// Dashboard e no Portal da Transparência. Arquivo único em /sounds/success.mp3.
// Funções client-only (usam Audio) — chame a partir de componentes "use client".

export const SUCCESS_SOUND_SRC = "/sounds/success.mp3";

let unlocked = false;
let audio: HTMLAudioElement | null = null;

/** Destrava o áudio (política de autoplay) — chamar dentro de um gesto do usuário. */
export function primeSuccessSound(): void {
  if (unlocked || typeof Audio === "undefined") return;
  try {
    const a = audio ?? new Audio(SUCCESS_SOUND_SRC);
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        unlocked = true;
      })
      .catch(() => {});
    audio = a;
  } catch {
    /* ignore */
  }
}

/** Toca o som de sucesso em volume cheio (se o navegador permitir). */
export function playSuccessSound(): void {
  if (typeof Audio === "undefined") return;
  try {
    const a = audio ?? new Audio(SUCCESS_SOUND_SRC);
    audio = a;
    a.muted = false;
    a.volume = 1;
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}
