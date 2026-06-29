"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { setLoginLogo } from "@/lib/actions/system-settings";
import { initialActionState } from "@/lib/types";
import type { GalleryImage } from "@/lib/system-settings";
import { MediaGalleryPicker } from "@/components/admin/media-gallery-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Gerencia a "Logo da Tela de Login" (configuração GLOBAL). Mostra a logo atual
 * e usa a Galeria de Mídia para trocá-la: clicar numa imagem da galeria a define
 * imediatamente como logo de login. "Restaurar padrão" volta ao fallback.
 *
 * @param displayUrl  URL exibida hoje no /login (já com fallback aplicado).
 * @param isCustom    true se há logo configurada no banco (não é o padrão).
 */
export function LoginLogoManager({
  images,
  displayUrl,
  isCustom,
}: {
  images: GalleryImage[];
  displayUrl: string;
  isCustom: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Otimista: reflete a seleção no preview enquanto a action grava no banco.
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null);
  const currentUrl = optimisticUrl ?? displayUrl;

  function apply(url: string | null) {
    setOptimisticUrl(url ?? "RESET");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("loginLogoUrl", url ?? "");
      const res = await setLoginLogo(initialActionState, fd);
      if (res.status === "success") {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
      setOptimisticUrl(null);
    });
  }

  // "RESET" é um marcador interno do estado otimista para voltar ao padrão.
  const previewUrl = currentUrl === "RESET" ? displayUrl : currentUrl;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-md border bg-slate-50 p-2">
          {pending && (
            <span className="absolute inset-0 flex items-center justify-center rounded-md bg-white/60">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Logo da tela de login"
            className="max-h-full max-w-full object-contain"
          />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-medium">Logo da tela de login</p>
            <Badge variant={isCustom ? "default" : "outline"}>
              {isCustom ? "Personalizada" : "Padrão"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Aparece no topo da tela de acesso ao painel (/login). Sem logo
            configurada, o sistema usa a logo padrão automaticamente.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <MediaGalleryPicker
              images={images}
              selectedUrl={isCustom ? displayUrl : null}
              onSelect={apply}
              triggerLabel="Alterar logo"
              title="Logo da tela de login"
              description="Clique numa imagem para defini-la como logo do login, ou envie uma nova."
              disabled={pending}
            />
            {isCustom && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => apply(null)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar padrão
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
