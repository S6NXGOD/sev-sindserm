"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Scale,
  Undo2,
} from "lucide-react";
import { setVagasVaziasAceitas } from "@/lib/actions/admin";
import { initialActionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type VagaVaziaItem = {
  id: string;
  nome: string;
  orgao: string;
  zona: string;
  vagas: number;
  vagasVazias: number;
};

function PendingButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** Linha de info do local (nome + órgão/zona/vagas). Reutilizada. */
function LocalInfo({ item }: { item: VagaVaziaItem }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold leading-tight">{item.nome}</p>
      <p className="text-xs text-muted-foreground">
        {item.orgao} · Zona {item.zona} · {item.vagasVazias} de {item.vagas}{" "}
        {item.vagas === 1 ? "vaga" : "vagas"} sem eleito
      </p>
    </div>
  );
}

/** "Manter assim" (finaliza sem suplementar) — com confirmação. */
function ManterAssimDialog({ item }: { item: VagaVaziaItem }) {
  const [state, formAction] = useFormState(
    setVagasVaziasAceitas,
    initialActionState,
  );
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full sm:w-auto">
          <Check className="mr-2 h-4 w-4" />
          Manter assim
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar sem suplementar?</DialogTitle>
          <DialogDescription>
            <strong>{item.nome}</strong> encerrou com {item.vagasVazias}{" "}
            {item.vagasVazias === 1 ? "vaga" : "vagas"} sem eleito. Marcar como
            finalizado assim (sem nova votação) — sai desta lista. Isso costuma ser
            o esperado quando há menos candidatos/votos que vagas. Você pode
            reverter depois.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <form action={formAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="aceito" value="true" />
            <PendingButton type="submit">Finalizar assim</PendingButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Reverter" (volta para a lista de decisão) — clique direto. */
function ReverterForm({ item }: { item: VagaVaziaItem }) {
  const [state, formAction] = useFormState(
    setVagasVaziasAceitas,
    initialActionState,
  );
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    else if (state.status === "error") toast.error(state.message);
  }, [state]);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="aceito" value="false" />
      <PendingButton
        type="submit"
        size="sm"
        variant="ghost"
        className="w-full sm:w-auto"
      >
        <Undo2 className="mr-2 h-4 w-4" />
        Reverter decisão
      </PendingButton>
    </form>
  );
}

/**
 * VAGAS SEM ELEITO — decisão caso a caso. Vaga vazia costuma ser NATURAL (nem
 * todo local tem candidatos/votos para todas as vagas). Para cada local, a
 * diretoria escolhe: agendar uma suplementar OU manter assim (finalizado).
 * Reversível e registrado na auditoria.
 */
export function VagasVaziasPanel({
  pendentes,
  aceitas,
}: {
  pendentes: VagaVaziaItem[];
  aceitas: VagaVaziaItem[];
}) {
  const [verAceitas, setVerAceitas] = useState(false);
  if (pendentes.length === 0 && aceitas.length === 0) return null;

  return (
    <section className="rounded-xl border-2 border-amber-300 bg-amber-50 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 p-4">
        <Scale className="h-5 w-5 shrink-0 text-amber-600" />
        <h2 className="text-base font-bold text-amber-900">Vagas sem eleito</h2>
        {pendentes.length > 0 && (
          <span className="rounded-full border border-amber-400 bg-white px-2 py-0.5 text-xs font-semibold text-amber-800">
            {pendentes.length} a decidir
          </span>
        )}
      </div>

      {pendentes.length > 0 ? (
        <>
          <p className="px-4 pt-3 text-xs text-amber-800">
            Estes locais encerraram com menos eleitos que vagas — muitas vezes é{" "}
            <strong>natural</strong> (menos candidatos ou votos que vagas). Para
            cada um, decida:
          </p>
          <ul className="divide-y divide-amber-200">
            {pendentes.map((item) => (
              <li key={item.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <LocalInfo item={item} />
                  <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
                    <ManterAssimDialog item={item} />
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      <Link href={`/admin/locais/${item.id}`}>
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Agendar suplementar
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-amber-200 p-4 text-xs text-amber-800">
            <strong>Agendar suplementar</strong> só é necessário quando você quer
            preencher as vagas que sobraram: cadastre novos candidatos no local e
            reabra/reagende a votação.
          </p>
        </>
      ) : (
        <p className="p-4 text-sm text-amber-800">
          Nenhuma decisão pendente — todos os locais com vaga sem eleito já foram
          finalizados.
        </p>
      )}

      {/* Finalizados sem suplementar (recolhível, reversível). */}
      {aceitas.length > 0 && (
        <div className="border-t border-amber-200">
          <button
            type="button"
            onClick={() => setVerAceitas((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-amber-900 hover:bg-amber-100/50"
          >
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              {aceitas.length} finalizado(s) sem suplementar
            </span>
            {verAceitas ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {verAceitas && (
            <ul className="divide-y divide-amber-200 border-t border-amber-200">
              {aceitas.map((item) => (
                <li key={item.id} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <LocalInfo item={item} />
                    <div className="sm:shrink-0">
                      <ReverterForm item={item} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
