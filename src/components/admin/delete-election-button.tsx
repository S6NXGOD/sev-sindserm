"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteElection } from "@/lib/actions/config";
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

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending || disabled}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Excluir
    </Button>
  );
}

/**
 * Exclusão de um pleito. Quando o ano tem dados (locais/votos) e este é o único
 * pleito do ano, a exclusão apaga TUDO do ano → exige digitar o ano para
 * confirmar. Caso contrário (sem dados, ou dados compartilhados com outro pleito
 * do mesmo ano), a confirmação é simples.
 */
export function DeleteElectionButton({
  electionId,
  ano,
  trienio,
  locais,
  compartilhaAno,
}: {
  electionId: string;
  ano: number;
  trienio: string;
  locais: number;
  /** Há outro pleito no mesmo ano? (dados são por ano, então ficam preservados) */
  compartilhaAno: boolean;
}) {
  const [state, formAction] = useFormState(deleteElection, initialActionState);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Só apaga dados (e exige confirmação) se houver locais e for o único do ano.
  const apagaDados = locais > 0 && !compartilhaAno;
  const podeExcluir = !apagaDados || confirmText.trim() === String(ano);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirmText("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Excluir pleito — Triênio {trienio}
          </DialogTitle>
          <DialogDescription>
            {apagaDados
              ? "Atenção: este pleito já possui dados."
              : compartilhaAno
                ? "Outro pleito usa o mesmo ano — os locais e votos do ano serão mantidos; apenas este pleito será removido."
                : "Este pleito ainda não possui dados. Ele será removido permanentemente."}
          </DialogDescription>
        </DialogHeader>

        {apagaDados && (
          <div className="space-y-3">
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                A exclusão é <strong>permanente</strong> e remove{" "}
                <strong>{locais}</strong>{" "}
                {locais === 1 ? "local" : "locais"} de votação do ano{" "}
                <strong>{ano}</strong> — junto com seus candidatos, votos e
                votantes. Não há como desfazer.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmacao-pleito">
                Para confirmar, digite o ano do pleito:{" "}
                <span className="font-semibold">{ano}</span>
              </Label>
              <Input
                id="confirmacao-pleito"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={String(ano)}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <form action={formAction}>
            <input type="hidden" name="id" value={electionId} />
            <input type="hidden" name="confirmacao" value={confirmText} />
            <SubmitButton disabled={!podeExcluir} />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
