"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { MediaGalleryPicker } from "@/components/admin/media-gallery-picker";
import {
  DEFAULT_LOGO,
  UPLOADS_PREFIX,
  type GalleryImage,
} from "@/lib/logo-constants";
import { Button } from "@/components/ui/button";

/**
 * Adaptador de CAMPO de formulário para a Galeria de Mídia única
 * (MediaGalleryPicker, em diálogo). Mantém a seleção em estado e a publica nos
 * campos que a Server Action interpreta (resolveLogoField):
 *   - <input hidden name={`${name}Existing`}> → URL da galeria escolhida
 *   - <input hidden name={`${name}Remove`}>   → "1" quando "sem logo" (oculta)
 *
 * Upload de imagens novas acontece DENTRO do diálogo (uploadGalleryImage), que
 * enriquece a galeria compartilhada — depois é só clicar para selecionar.
 *
 * Regra estrita:
 *   - sindserm: sem seleção → preview da logo padrão (DEFAULT_LOGO); não removível.
 *   - pleito:   sem seleção → "Sem logo" (oculto no layout; sem fallback).
 */

type Selection = { kind: "existing"; url: string } | { kind: "none" };

function initialSelection(currentUrl?: string | null): Selection {
  if (currentUrl && currentUrl.startsWith(UPLOADS_PREFIX)) {
    return { kind: "existing", url: currentUrl };
  }
  return { kind: "none" };
}

export function LogoPickerField({
  name,
  tipo,
  images,
  currentUrl,
  helpText,
}: {
  /** Nome-base dos campos enviados ao formulário pai (ex.: "file", "logoPleito"). */
  name: string;
  tipo: "sindserm" | "pleito";
  images: GalleryImage[];
  /** Valor atual salvo (URL da galeria, DEFAULT ou null). Só para edição. */
  currentUrl?: string | null;
  helpText?: string;
}) {
  const [selection, setSelection] = useState<Selection>(() =>
    initialSelection(currentUrl),
  );

  const preview = (() => {
    if (selection.kind === "existing") {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={selection.url}
          alt="Pré-visualização"
          className="max-h-full max-w-full object-contain"
        />
      );
    }
    if (tipo === "sindserm") {
      // SINDSERM nunca fica sem logo: cai no DEFAULT_LOGO.
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={DEFAULT_LOGO}
          alt="Logo padrão"
          className="max-h-full max-w-full object-contain opacity-90"
        />
      );
    }
    // Pleito sem logo: ocultado graciosamente (sem fallback, sem imagem quebrada).
    return (
      <div className="flex flex-col items-center gap-1 text-muted-foreground">
        <ImageOff className="h-6 w-6" />
        <span className="text-[11px]">Sem logo</span>
      </div>
    );
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-md border bg-slate-50 p-2">
          {preview}
        </div>

        <div className="min-w-[200px] flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <MediaGalleryPicker
              images={images}
              selectedUrl={selection.kind === "existing" ? selection.url : null}
              onSelect={(url) => setSelection({ kind: "existing", url })}
              onImageDeleted={(url) => {
                // Se a imagem excluída era a selecionada (ainda não salva),
                // limpa a seleção para não ficar com preview quebrado.
                if (selection.kind === "existing" && selection.url === url) {
                  setSelection({ kind: "none" });
                }
              }}
              triggerLabel={
                selection.kind === "existing" ? "Trocar imagem" : "Escolher / enviar"
              }
              title={tipo === "sindserm" ? "Logo do SINDSERM" : "Logo do Pleito"}
              description="Clique numa imagem para usá-la, ou envie uma nova."
            />

            {/* Só o pleito pode ficar sem logo (ocultar). */}
            {tipo === "pleito" && selection.kind === "existing" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelection({ kind: "none" })}
              >
                <ImageOff className="mr-2 h-4 w-4" />
                Sem logo
              </Button>
            )}

            {selection.kind === "none" && (
              <span className="text-[11px] text-muted-foreground">
                {tipo === "pleito" ? "(oculto no layout)" : "(padrão)"}
              </span>
            )}
          </div>
          {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
        </div>
      </div>

      {/* Campos lidos pela Server Action (resolveLogoField). */}
      <input
        type="hidden"
        name={`${name}Existing`}
        value={selection.kind === "existing" ? selection.url : ""}
      />
      <input
        type="hidden"
        name={`${name}Remove`}
        value={selection.kind === "none" ? "1" : ""}
      />
    </div>
  );
}
