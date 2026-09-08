"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Radio } from "lucide-react";
import { setParciaisPublicas } from "@/lib/actions/config";
import { initialActionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Liga/desliga a APURAÇÃO AO VIVO pública do pleito. LIGAR é sensível (efeito
 * manada) → confirmação explícita. DESLIGAR é seguro → aplica direto. O estado
 * exibido vem do valor SALVO (`ativo`); após salvar, o revalidate atualiza.
 */
export function ParciaisPublicasToggle({
  electionId,
  ativo,
}: {
  electionId: string;
  ativo: boolean;
}) {
  const [state, formAction] = useFormState(
    setParciaisPublicas,
    initialActionState,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const ativoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setConfirmOpen(false);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
    setPending(false);
  }, [state]);

  function submeter(target: boolean) {
    if (ativoRef.current) ativoRef.current.value = target ? "true" : "false";
    setPending(true);
    formRef.current?.requestSubmit();
  }

  function onSwitch(next: boolean) {
    if (next) setConfirmOpen(true); // ligar → confirma
    else submeter(false); // desligar → direto (seguro)
  }

  return (
    <>
      {/* Form oculto reutilizado pelos dois caminhos (ligar/desligar). */}
      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="id" value={electionId} />
        <input ref={ativoRef} type="hidden" name="ativo" defaultValue="false" />
      </form>

      <div className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Radio className="h-4 w-4 text-primary" />
            Apuração ao vivo pública
          </p>
          <p className="text-xs text-muted-foreground">
            {ativo
              ? "LIGADA — os locais abertos mostram quem está liderando (parcial) no portal público."
              : "DESLIGADA (recomendado) — as parciais só aparecem quando o local encerra."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <Switch checked={ativo} onCheckedChange={onSwitch} disabled={pending} />
        </div>
      </div>

      {ativo && (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Enquanto ligada, quem ainda não votou vê quem está ganhando — pode
            gerar <strong>efeito manada</strong> e voto tático. Use com critério.
          </span>
        </p>
      )}

      {/* Confirmação ao LIGAR */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tornar as parciais públicas ao vivo?</DialogTitle>
            <DialogDescription>
              Os locais com votação <strong>ABERTA</strong> passarão a mostrar{" "}
              <strong>quem está liderando</strong> (parcial) no portal público, em
              tempo real. Quem ainda não votou pode ser influenciado (efeito
              manada / voto tático). O padrão seguro é deixar DESLIGADO e revelar
              só quando o local encerra. Deseja ligar mesmo assim?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => submeter(true)}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ligar ao vivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
