"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { setElectionLogo } from "@/lib/actions/config";
import { initialActionState } from "@/lib/types";
import type { GalleryImage } from "@/lib/system-settings";
import { MediaGalleryPicker } from "@/components/admin/media-gallery-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Gerencia UMA logo de um pleito (Election) pela Galeria de Mídia. Espelha o
 * padrão do LoginLogoManager: mostra a logo atual, abre o MediaGalleryPicker
 * para escolher/enviar uma imagem e persiste via setElectionLogo (por ID do
 * pleito). Só o pleito admite "remover" (o SINDSERM cai na logo padrão).
 */
export function ElectionLogoManager({
  electionId,
  tipo,
  label,
  currentUrl,
  placeholderUrl,
  images,
  allowClear,
  recomendacao,
}: {
  electionId: string;
  tipo: "sindserm" | "pleito";
  label: string;
  /** URL salva hoje (null = sem logo, mostra placeholder). */
  currentUrl: string | null;
  /** Imagem neutra exibida no preview quando não há logo. */
  placeholderUrl: string;
  images: GalleryImage[];
  allowClear: boolean;
  recomendacao: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Otimista: "CLEAR" marca remoção; uma URL marca seleção; null = sem override.
  const [optimistic, setOptimistic] = useState<string | null>(null);

  const effectiveUrl =
    optimistic === "CLEAR" ? null : (optimistic ?? currentUrl);
  const previewUrl = effectiveUrl ?? placeholderUrl;
  const temLogo = effectiveUrl !== null;

  function apply(url: string | null) {
    setOptimistic(url ?? "CLEAR");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", electionId);
      fd.set("tipo", tipo);
      fd.set("url", url ?? "");
      const res = await setElectionLogo(initialActionState, fd);
      if (res.status === "success") {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
      setOptimistic(null);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <p className="font-medium">{label}</p>
        <Badge variant={temLogo ? "default" : "outline"}>
          {temLogo ? "Definida" : tipo === "sindserm" ? "Padrão" : "Sem logo"}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex h-20 w-36 items-center justify-center rounded-md border bg-slate-50 p-2">
          {pending && (
            <span className="absolute inset-0 flex items-center justify-center rounded-md bg-white/60">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">{recomendacao}</p>
          <div className="flex flex-wrap items-center gap-2">
            <MediaGalleryPicker
              images={images}
              selectedUrl={effectiveUrl}
              onSelect={(url) => apply(url)}
              triggerLabel="Escolher da galeria"
              title={`Galeria de Mídia — ${label}`}
              description="Clique numa imagem para usá-la nesta logo, ou envie uma nova."
              disabled={pending}
            />
            {allowClear && temLogo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => apply(null)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover logo
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
