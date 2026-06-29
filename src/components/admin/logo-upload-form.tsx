"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { uploadElectionLogo } from "@/lib/actions/config";
import { initialActionState } from "@/lib/types";
import type { GalleryImage } from "@/lib/logo-constants";
import { Button } from "@/components/ui/button";
import { LogoPickerField } from "@/components/admin/logo-picker-field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Upload className="mr-2 h-4 w-4" />
      )}
      Enviar
    </Button>
  );
}

const RECOMENDACAO: Record<"sindserm" | "pleito", string> = {
  sindserm: "Recomendado: ~600×180 px (horizontal), PNG com fundo transparente.",
  pleito: "Recomendado: ~400×400 px (quadrada), PNG com fundo transparente.",
};

export function LogoUploadForm({
  ano,
  tipo,
  label,
  currentUrl,
  images,
}: {
  ano: number;
  tipo: "sindserm" | "pleito";
  label: string;
  // Pleito pode não ter logo (regra estrita: sem fallback) → null.
  currentUrl: string | null;
  /** Imagens da Galeria de Mídia (carregadas no server e passadas por prop). */
  images: GalleryImage[];
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(
    uploadElectionLogo,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
      router.refresh();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="font-medium">{label}</p>
      <form ref={formRef} action={formAction} className="space-y-3">
        <input type="hidden" name="ano" value={ano} />
        <input type="hidden" name="tipo" value={tipo} />
        {/* Galeria de mídia: reusa uma imagem anterior, envia nova ou (pleito) oculta. */}
        <LogoPickerField
          name="file"
          tipo={tipo}
          images={images}
          currentUrl={currentUrl}
          helpText={RECOMENDACAO[tipo]}
        />
        <SubmitButton />
      </form>
    </div>
  );
}
