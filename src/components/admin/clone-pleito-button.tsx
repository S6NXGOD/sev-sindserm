"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { clonePleito } from "@/lib/actions/config";
import { initialActionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Copy className="mr-2 h-4 w-4" />
      )}
      Duplicar pleito
    </Button>
  );
}

/**
 * Botão + diálogo de DUPLICAÇÃO de pleito. Pede o título e o ano do novo pleito
 * (sugere ano+1) e dispara a Server Action clonePleito (copia locais e
 * candidatos; NÃO copia votos/eleitores).
 */
export function ClonePleitoButton({
  electionId,
  anoOriginal,
  tituloOriginal,
}: {
  electionId: string;
  anoOriginal: number;
  tituloOriginal: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(clonePleito, initialActionState);
  const [titulo, setTitulo] = useState("");
  const [ano, setAno] = useState("");

  useEffect(() => {
    if (open) {
      setTitulo(tituloOriginal);
      setAno(String(anoOriginal + 1));
    }
  }, [open, tituloOriginal, anoOriginal]);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
      router.refresh();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full">
          <Copy className="mr-2 h-4 w-4" />
          Duplicar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicar pleito</DialogTitle>
          <DialogDescription>
            Cria um NOVO pleito reaproveitando os <strong>locais</strong> e{" "}
            <strong>candidatos</strong> deste. Votos, eleitores e comparecimentos{" "}
            <strong>não</strong> são copiados — o novo pleito nasce limpo.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="sourceId" value={electionId} />
          <div className="space-y-2">
            <Label htmlFor="clone-titulo">Título do novo pleito *</Label>
            <Input
              id="clone-titulo"
              name="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clone-ano">Ano do novo pleito *</Label>
            <Input
              id="clone-ano"
              name="ano"
              type="number"
              min={2000}
              max={3000}
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Precisa ser um ano <strong>diferente</strong> e ainda{" "}
              <strong>sem locais</strong> — a estrutura é isolada por ano.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
