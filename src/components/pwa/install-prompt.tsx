"use client";

import { useEffect, useState } from "react";
import { Download, MoreVertical, Plus, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Platform = "ios" | "android" | "other";
const DISMISS_KEY = "sev-pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Detecta a plataforma pelo user-agent (iPad iOS 13+ se passa por Mac). */
function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && "ontouchend" in document);
  if (isIOS) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

/** App já aberto como PWA instalado? (não faz sentido oferecer instalar). */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Convite de instalação do PWA, sensível à plataforma:
 *  - iPhone/iPad: passo a passo do Safari ("Adicionar à Tela de Início").
 *  - Android: dispara o prompt nativo do Chrome quando disponível; senão, o
 *    passo a passo do menu do Chrome.
 *  - Desktop/PC: não exibe nada.
 * Dispensável (lembra no localStorage) e oculto quando já instalado.
 */
export function InstallPwaPrompt() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* localStorage indisponível: segue mostrando */
    }

    const p = detectPlatform();
    if (p === "other") return; // Desktop/PC: não mostra nada.
    setPlatform(p);
    setShow(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // impede o mini-infobar; usamos nosso botão
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setShow(false);
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignora */
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function hidePermanently() {
    setShow(false);
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignora */
    }
  }

  async function handlePrimary() {
    // Android com prompt nativo disponível → usa o prompt do Chrome.
    if (platform === "android" && deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === "accepted") hidePermanently();
      return;
    }
    // iOS (sempre) ou Android sem prompt → abre o passo a passo manual.
    setOpen(true);
  }

  if (!show || platform === "other") return null;

  return (
    <>
      {/* Pílula flutuante (só iOS/Android, fora do modo instalado). O wrapper é
          "pass-through" para não bloquear toques no conteúdo atrás dele. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 print:hidden">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icones/LOGO_SEV.png"
            alt=""
            className="h-7 w-7 rounded"
          />
          <span className="text-sm font-medium text-slate-800">
            Instalar o app SEV
          </span>
          <Button
            type="button"
            size="sm"
            onClick={handlePrimary}
            className="h-8 rounded-full"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Instalar
          </Button>
          <button
            type="button"
            onClick={hidePermanently}
            aria-label="Dispensar"
            className="ml-0.5 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icones/LOGO_SEV.png"
                alt=""
                className="h-8 w-8 rounded"
              />
              Instalar o SEV SINDSERM
            </DialogTitle>
            <DialogDescription>
              {platform === "ios"
                ? "Adicione o app à Tela de Início do seu iPhone:"
                : "Adicione o app à tela inicial do seu Android:"}
            </DialogDescription>
          </DialogHeader>

          {platform === "ios" ? (
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <StepNumber n={1} />
                <span>
                  Toque em <strong>Compartilhar</strong>{" "}
                  <Share className="inline h-4 w-4 -translate-y-0.5" /> na barra
                  do Safari (o quadrado com a seta para cima).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StepNumber n={2} />
                <span>
                  Role e escolha{" "}
                  <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>{" "}
                  <Plus className="inline h-4 w-4 -translate-y-0.5" />.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StepNumber n={3} />
                <span>
                  Toque em <strong>&ldquo;Adicionar&rdquo;</strong> no canto
                  superior direito.
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <StepNumber n={1} />
                <span>
                  Toque no menu{" "}
                  <MoreVertical className="inline h-4 w-4 -translate-y-0.5" />{" "}
                  <strong>(⋮)</strong> no canto superior direito do Chrome.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StepNumber n={2} />
                <span>
                  Escolha <strong>&ldquo;Instalar app&rdquo;</strong> (ou
                  &ldquo;Adicionar à tela inicial&rdquo;).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StepNumber n={3} />
                <span>
                  Confirme em <strong>&ldquo;Instalar&rdquo;</strong>.
                </span>
              </li>
            </ol>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={hidePermanently}
            className="mt-1 text-muted-foreground"
          >
            Não mostrar novamente
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
      {n}
    </span>
  );
}
