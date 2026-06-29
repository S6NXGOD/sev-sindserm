"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, Upload } from "lucide-react";
import { uploadGalleryImage } from "@/lib/actions/system-settings";
import { initialActionState } from "@/lib/types";
import type { GalleryImage } from "@/lib/system-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Upload className="mr-2 h-4 w-4" />
      )}
      Enviar para a galeria
    </Button>
  );
}

/**
 * Galeria de Mídia (reutilizável). Abre um diálogo que lista todas as imagens
 * de public/uploads/logos/. O usuário pode:
 *  - clicar numa imagem existente para selecioná-la (chama onSelect e fecha), ou
 *  - enviar uma nova imagem (fica salva na galeria para usos futuros).
 *
 * Componente "burro": apenas emite a URL escolhida via onSelect. Quem usa decide
 * o que fazer com ela (ex.: definir como logo de login).
 */
export function MediaGalleryPicker({
  images,
  selectedUrl = null,
  onSelect,
  triggerLabel = "Escolher da galeria",
  title = "Galeria de Mídia",
  description = "Clique numa imagem para usá-la, ou envie uma nova.",
  disabled = false,
}: {
  images: GalleryImage[];
  selectedUrl?: string | null;
  onSelect: (url: string) => void;
  triggerLabel?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    uploadGalleryImage,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
      // Recarrega o server component para a nova imagem aparecer na grade.
      router.refresh();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  function handlePick(url: string) {
    onSelect(url);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <ImagePlus className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {images.length === 0 ? (
          <p className="rounded-md border border-dashed bg-slate-50 px-3 py-8 text-center text-sm text-muted-foreground">
            Nenhuma imagem na galeria ainda. Envie a primeira abaixo.
          </p>
        ) : (
          <div className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {images.map((img) => {
              const isSelected = img.url === selectedUrl;
              return (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => handlePick(img.url)}
                  title={img.name}
                  className={cn(
                    "group relative flex aspect-[4/3] items-center justify-center rounded-lg border bg-slate-50 p-2 transition hover:border-primary hover:ring-2 hover:ring-primary/30",
                    isSelected && "border-primary ring-2 ring-primary",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.name}
                    className="max-h-full max-w-full object-contain"
                  />
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <form
          ref={formRef}
          action={formAction}
          className="space-y-2 rounded-lg border bg-slate-50/60 p-3"
        >
          <Label htmlFor="gallery-upload" className="text-xs font-medium">
            Enviar nova imagem (PNG, JPG, WEBP ou SVG · até 2 MB)
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="gallery-upload"
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              required
              className="block flex-1 text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <UploadButton />
          </div>
          <p className="text-xs text-muted-foreground">
            A imagem fica salva na galeria; depois clique nela acima para usá-la.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
