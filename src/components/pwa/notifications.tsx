"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, BellRing, Loader2, X } from "lucide-react";
import {
  getPushConfig,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/actions/push";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const DISMISS_KEY = "sev-push-prompt-dismissed";

/** Converte a chave VAPID (base64url) para o formato que o PushManager exige. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type Estado = {
  supported: boolean;
  enabled: boolean; // chaves VAPID configuradas no servidor
  permission: NotificationPermission;
  subscribed: boolean;
  publicKey: string;
  loaded: boolean;
};

function usePush() {
  const [st, setSt] = useState<Estado>({
    supported: false,
    enabled: false,
    permission: "default",
    subscribed: false,
    publicKey: "",
    loaded: false,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      setSt((s) => ({ ...s, supported: false, loaded: true }));
      return;
    }
    let cancel = false;
    (async () => {
      const cfg = await getPushConfig();
      let subscribed = false;
      if (cfg.enabled) {
        try {
          const reg = await navigator.serviceWorker.ready;
          subscribed = Boolean(await reg.pushManager.getSubscription());
        } catch {
          /* ignora */
        }
      }
      if (cancel) return;
      setSt({
        supported: true,
        enabled: cfg.enabled,
        permission: Notification.permission,
        subscribed,
        publicKey: cfg.publicKey,
        loaded: true,
      });
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const ativar = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setSt((s) => ({ ...s, permission }));
      if (permission !== "granted") {
        toast.error("Permissão de notificações negada no navegador.");
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(st.publicKey),
        });
      }
      const json = sub.toJSON();
      const res = await savePushSubscription(
        {
          endpoint: json.endpoint!,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        },
        navigator.userAgent,
      );
      if (!res.ok) throw new Error("save falhou");
      setSt((s) => ({ ...s, subscribed: true }));
      toast.success("Notificações ativadas neste dispositivo.");
      return true;
    } catch {
      toast.error("Não foi possível ativar as notificações.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [st.publicKey]);

  const desativar = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSt((s) => ({ ...s, subscribed: false }));
      toast.success("Notificações desativadas neste dispositivo.");
    } catch {
      toast.error("Não foi possível desativar.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { ...st, busy, ativar, desativar };
}

/**
 * PROMPT de primeiro login (banner discreto). Aparece só quando: suportado,
 * push habilitado no servidor, ainda sem permissão concedida e não dispensado.
 */
export function NotificationsPrompt() {
  const push = usePush();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (!push.loaded || !push.supported || !push.enabled) return null;
  if (push.subscribed || push.permission === "denied" || dismissed) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Receber avisos das votações?</p>
          <p className="text-xs text-muted-foreground">
            Ative para ser avisado quando uma votação for agendada, começar ou
            encerrar.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Agora não
        </Button>
        <Button size="sm" onClick={push.ativar} disabled={push.busy}>
          {push.busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bell className="mr-2 h-4 w-4" />
          )}
          Ativar
        </Button>
      </div>
    </div>
  );
}

/**
 * SINO no cabeçalho (PWA): botão sempre acessível para ligar/desligar as
 * notificações. Um pontinho âmbar avisa quando dá para ativar mas está desligado.
 * Se o push não estiver configurado no servidor, o sino não aparece.
 */
export function NotificationsBell() {
  const push = usePush();
  if (!push.loaded || !push.supported || !push.enabled) return null;

  const precisaAtivar = !push.subscribed && push.permission !== "denied";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificações"
        >
          {push.subscribed ? (
            <BellRing className="h-5 w-5 text-primary" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {precisaAtivar && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="mb-2 text-sm font-semibold">Notificações</p>
        <NotificationsToggle />
      </PopoverContent>
    </Popover>
  );
}

/** Controle completo (Configurações): status + ligar/desligar neste dispositivo. */
export function NotificationsToggle() {
  const push = usePush();

  if (!push.loaded) {
    return (
      <p className="text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Verificando…
      </p>
    );
  }
  if (!push.supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Este navegador não suporta notificações. No iPhone, adicione o app à Tela
        de Início (Safari → Compartilhar → Adicionar à Tela de Início) e abra por
        lá.
      </p>
    );
  }
  if (!push.enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        As notificações ainda não foram configuradas no servidor (chaves VAPID).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${
            push.subscribed ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
        {push.subscribed
          ? "Ativadas neste dispositivo."
          : push.permission === "denied"
            ? "Bloqueadas no navegador — libere nas configurações do site."
            : "Desativadas neste dispositivo."}
      </div>
      {push.subscribed ? (
        <Button variant="outline" onClick={push.desativar} disabled={push.busy}>
          {push.busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <BellOff className="mr-2 h-4 w-4" />
          )}
          Desativar neste dispositivo
        </Button>
      ) : (
        <Button
          onClick={push.ativar}
          disabled={push.busy || push.permission === "denied"}
        >
          {push.busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bell className="mr-2 h-4 w-4" />
          )}
          Ativar notificações
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        As notificações são por dispositivo — ative em cada aparelho que quiser
        receber. No iPhone, funciona apenas com o app instalado na Tela de Início.
      </p>
    </div>
  );
}
