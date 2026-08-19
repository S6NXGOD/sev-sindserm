"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/admin/avatar";
import { Button } from "@/components/ui/button";

const LADO = 256; // lado do quadrado final (px)

/**
 * Lê um File de imagem, recorta no centro (quadrado) e redimensiona para 256px,
 * devolvendo um data URL JPEG (~20-40KB). Roda 100% no cliente (canvas).
 */
function processar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("leitura"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("imagem"));
      img.onload = () => {
        const lado = Math.min(img.width, img.height);
        const sx = (img.width - lado) / 2;
        const sy = (img.height - lado) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = LADO;
        canvas.height = LADO;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, LADO, LADO);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Seletor de foto de perfil (controlado). O valor (`value`) é o data URL atual
 * — pode ser a foto salva ou null. `onChange` recebe o novo data URL ou null.
 * O valor deve ser enviado ao servidor num input hidden `name="fotoUrl"`.
 */
export function PhotoInput({
  nome,
  value,
  onChange,
}: {
  nome: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reescolher o mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    setBusy(true);
    try {
      onChange(await processar(file));
    } catch {
      toast.error("Não foi possível processar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar nome={nome} fotoUrl={value} size={72} />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Camera className="mr-2 h-4 w-4" />
          {value ? "Trocar foto" : "Adicionar foto"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onChange(null)}
            disabled={busy}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remover
          </Button>
        )}
      </div>
    </div>
  );
}
