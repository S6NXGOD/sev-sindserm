"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  Award,
  CalendarPlus,
  ChevronDown,
  Gavel,
  Loader2,
  PartyPopper,
  Search,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Undo2,
} from "lucide-react";
import {
  afastarRepresentante,
  convocarSuplente,
  desfazerHomologacao,
  empossarColetivo,
  homologarResultados,
  reativarRepresentante,
  registrarPosse,
  registrarVacancia,
  reverterMandato,
} from "@/lib/actions/mandato";
import { initialActionState } from "@/lib/types";
import {
  MOTIVOS_VACANCIA,
  MOTIVO_LABEL,
  dataCurta,
  type MandatoView,
} from "@/lib/mandato-constants";
import type { AptoLocal, MandatoLinha } from "@/lib/mandato";
import { cn } from "@/lib/utils";
import { searchScore, searchTokens } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function Pending({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** Hook: ao concluir uma action, toast + refresh (e callback opcional p/ fechar). */
function useActionToast(
  state: { status: string; message: string },
  onSuccess?: () => void,
) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.refresh();
      onSuccess?.();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

/* ------------------------------ Homologação ------------------------------ */

function HomologarTodosForm({ ano, count }: { ano: number; count: number }) {
  const [state, formAction] = useFormState(
    homologarResultados,
    initialActionState,
  );
  useActionToast(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="ano" value={ano} />
      <Pending type="submit">
        <ShieldCheck className="mr-2 h-4 w-4" />
        Homologar {count} {count === 1 ? "local" : "locais"}
      </Pending>
    </form>
  );
}

/* ---------------------------- Posse coletiva ----------------------------- */

function PosseColetivaCard({ ano, pendentes }: { ano: number; pendentes: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(empossarColetivo, initialActionState);
  useActionToast(state, () => setOpen(false));
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <Card className="border-emerald-200 bg-emerald-50/60">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <PartyPopper className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">Posse coletiva</p>
            <p className="text-sm text-muted-foreground">
              {pendentes} representante(s) aguardando posse. Emposse todos de uma
              vez com a data da cerimônia — sem ir de um em um.
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <UserCheck className="mr-2 h-4 w-4" />
              Dar posse a todos
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Posse coletiva</DialogTitle>
              <DialogDescription>
                Registra a MESMA data de posse para os {pendentes} representantes
                em exercício que ainda não foram empossados. Quem já tem posse não
                é alterado (reversível por representante no “Gerenciar”).
              </DialogDescription>
            </DialogHeader>
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="ano" value={ano} />
              <div className="space-y-1.5">
                <Label htmlFor="posse-coletiva-data">
                  Data da posse (cerimônia)
                </Label>
                <Input
                  id="posse-coletiva-data"
                  name="data"
                  type="date"
                  defaultValue={hoje}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Pending type="submit">
                  <UserCheck className="mr-2 h-4 w-4" />
                  Empossar {pendentes}
                </Pending>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Convocação ------------------------------- */

function ConvocarForm({
  workplaceId,
  substituiuNome,
  proximoNome,
}: {
  workplaceId: string;
  substituiuNome: string | null;
  proximoNome: string;
}) {
  const [state, formAction] = useFormState(convocarSuplente, initialActionState);
  useActionToast(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="workplaceId" value={workplaceId} />
      {substituiuNome && (
        <input type="hidden" name="substituiuNome" value={substituiuNome} />
      )}
      <Pending type="submit" size="sm">
        <UserPlus className="mr-2 h-4 w-4" />
        Convocar {proximoNome}
      </Pending>
    </form>
  );
}

/* --------------------------- Reverter (undo) ----------------------------- */

function ReverterForm({ id, label }: { id: string; label: string }) {
  const [state, formAction] = useFormState(reverterMandato, initialActionState);
  useActionToast(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Pending type="submit" size="sm" variant="ghost">
        <Undo2 className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </Pending>
    </form>
  );
}

function DesfazerHomologarForm({ workplaceId }: { workplaceId: string }) {
  const [state, formAction] = useFormState(
    desfazerHomologacao,
    initialActionState,
  );
  useActionToast(state);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Desfazer a homologação deste local? (só é possível se nada ainda foi registrado)"))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="workplaceId" value={workplaceId} />
      <Pending type="submit" size="sm" variant="ghost" className="text-slate-500">
        Desfazer homologação
      </Pending>
    </form>
  );
}

/* ------------------- Gerenciar UM representante (dialog) ------------------ */

function GerenciarDialog({ m }: { m: MandatoLinha }) {
  const [open, setOpen] = useState(false);
  const fechar = () => setOpen(false);

  // Formulários independentes (cada um com seu estado).
  const [vac, vacAction] = useFormState(registrarVacancia, initialActionState);
  const [afa, afaAction] = useFormState(afastarRepresentante, initialActionState);
  const [rea, reaAction] = useFormState(reativarRepresentante, initialActionState);
  const [pos, posAction] = useFormState(registrarPosse, initialActionState);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_VACANCIA[0].id);
  useActionToast(vac, fechar);
  useActionToast(afa, fechar);
  useActionToast(rea, fechar);
  useActionToast(pos, fechar);

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="mr-1.5 h-4 w-4" />
          Gerenciar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{m.nome}</DialogTitle>
          <DialogDescription>
            {m.localNome} · {m.orgao} · Zona {m.zona} · {m.votosHomologados} voto(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Posse */}
          <form action={posAction} className="space-y-2">
            <Label htmlFor={`posse-${m.id}`} className="text-xs font-semibold uppercase text-muted-foreground">
              Posse {m.posseEm ? `(registrada em ${dataCurta(m.posseEm)})` : ""}
            </Label>
            <div className="flex gap-2">
              <input type="hidden" name="id" value={m.id} />
              <Input id={`posse-${m.id}`} name="data" type="date" defaultValue={hoje} className="h-9" />
              <Pending type="submit" size="sm" variant="outline">
                <UserCheck className="mr-1.5 h-4 w-4" />
                Registrar posse
              </Pending>
            </div>
          </form>

          {/* Afastar / Reativar */}
          {m.situacao === "AFASTADO" ? (
            <form action={reaAction} className="rounded-lg border bg-amber-50/60 p-3">
              <p className="mb-2 text-xs text-amber-800">
                Afastado (licença). Reative quando o representante retornar.
              </p>
              <input type="hidden" name="id" value={m.id} />
              <Pending type="submit" size="sm" variant="outline">
                <UserCheck className="mr-1.5 h-4 w-4" />
                Reativar (fim da licença)
              </Pending>
            </form>
          ) : (
            <form action={afaAction} className="space-y-2">
              <Label htmlFor={`afa-${m.id}`} className="text-xs font-semibold uppercase text-muted-foreground">
                Afastar (licença temporária)
              </Label>
              <input type="hidden" name="id" value={m.id} />
              <Input id={`afa-${m.id}`} name="observacao" placeholder="Ex.: licença-saúde até 30/11 (opcional)" className="h-9" />
              <Pending type="submit" size="sm" variant="outline">
                <UserMinus className="mr-1.5 h-4 w-4" />
                Afastar
              </Pending>
            </form>
          )}

          {/* Vacância (saída definitiva) */}
          <form action={vacAction} className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/50 p-3">
            <p className="text-xs font-semibold uppercase text-rose-700">
              Registrar vacância (saída definitiva)
            </p>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="motivo" value={motivo} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_VACANCIA.map((mo) => (
                    <SelectItem key={mo.id} value={mo.id}>
                      {mo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input name="data" type="date" defaultValue={hoje} className="h-9" />
            </div>
            <Input name="observacao" placeholder="Observação (opcional)" className="h-9" />
            <p className="text-xs text-muted-foreground">
              {MOTIVOS_VACANCIA.find((mo) => mo.id === motivo)?.descricao}
            </p>
            <Pending
              type="submit"
              size="sm"
              className="bg-rose-600 hover:bg-rose-700"
              onClick={(e) => {
                if (
                  !window.confirm(
                    `Registrar a saída definitiva de ${m.nome}? O mandato será encerrado (reversível).`,
                  )
                )
                  e.preventDefault();
              }}
            >
              <Gavel className="mr-1.5 h-4 w-4" />
              Encerrar mandato
            </Pending>
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={fechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Agrupamento ----------------------------- */

type Grupo = {
  workplaceId: string;
  localNome: string;
  orgao: string;
  zona: string;
  seats: number;
  vagasAbertas: number;
  ativos: MandatoLinha[];
  afastados: MandatoLinha[];
  reserva: MandatoLinha[];
  encerrados: MandatoLinha[];
  intocado: boolean;
  ultimaSaidaNome: string | null;
};

function agrupar(mandatos: MandatoLinha[]): Grupo[] {
  const byLocal = new Map<string, MandatoLinha[]>();
  for (const m of mandatos) {
    const arr = byLocal.get(m.workplaceId) ?? [];
    arr.push(m);
    byLocal.set(m.workplaceId, arr);
  }
  const grupos: Grupo[] = [];
  for (const [workplaceId, arr] of byLocal) {
    const seats = arr.filter((m) => m.papel === "TITULAR").length;
    const ativos = arr
      .filter((m) => m.situacao === "ATIVO")
      .sort((a, b) => a.ordem - b.ordem);
    const afastados = arr.filter((m) => m.situacao === "AFASTADO");
    const reserva = arr
      .filter((m) => m.situacao === "RESERVA")
      .sort((a, b) => a.ordem - b.ordem);
    const encerrados = arr
      .filter((m) => m.situacao === "ENCERRADO")
      .sort(
        (a, b) => (b.saidaEm?.getTime() ?? 0) - (a.saidaEm?.getTime() ?? 0),
      );
    const servindo = ativos.length + afastados.length;
    const vagasAbertas = Math.max(0, seats - servindo);
    const intocado = arr.every(
      (m) =>
        !m.posseEm &&
        !m.saidaEm &&
        !m.assumiuEm &&
        ((m.papel === "TITULAR" && m.situacao === "ATIVO") ||
          (m.papel === "SUPLENTE" && m.situacao === "RESERVA")),
    );
    grupos.push({
      workplaceId,
      localNome: arr[0].localNome,
      orgao: arr[0].orgao,
      zona: arr[0].zona,
      seats,
      vagasAbertas,
      ativos,
      afastados,
      reserva,
      encerrados,
      intocado,
      ultimaSaidaNome: encerrados[0]?.nome ?? null,
    });
  }
  return grupos.sort(
    (a, b) =>
      a.orgao.localeCompare(b.orgao) || a.localNome.localeCompare(b.localNome),
  );
}

/* --------------------------------- Linha --------------------------------- */

function PapelTag({ m }: { m: MandatoView }) {
  const convocado = m.papel === "SUPLENTE" && m.assumiuEm != null;
  if (convocado) {
    return (
      <Badge className="bg-sky-600 hover:bg-sky-600">Suplente convocado</Badge>
    );
  }
  if (m.papel === "TITULAR")
    return <Badge variant="success">Titular</Badge>;
  return (
    <Badge variant="outline" className="border-sky-300 text-sky-700">
      Suplente
    </Badge>
  );
}

function HolderRow({ m, canManage }: { m: MandatoLinha; canManage: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
      <Award className="h-4 w-4 shrink-0 text-emerald-600" />
      <span className="font-medium">{m.nome}</span>
      <PapelTag m={m} />
      {m.situacao === "AFASTADO" && (
        <Badge variant="outline" className="border-amber-300 text-amber-700">
          Afastado
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">
        {m.votosHomologados} voto(s)
        {m.posseEm ? ` · posse ${dataCurta(m.posseEm)}` : ""}
        {m.substituiuNome ? ` · no lugar de ${m.substituiuNome}` : ""}
      </span>
      {canManage && (
        <span className="ml-auto">
          <GerenciarDialog m={m} />
        </span>
      )}
    </div>
  );
}

/* ------------------------------- Componente ------------------------------ */

type ChipId = "todos" | "vaga_aberta" | "afastados";

export function RepresentantesManager({
  mandatos,
  aptos,
  ano,
  canManage,
}: {
  mandatos: MandatoLinha[];
  aptos: AptoLocal[];
  ano: number;
  canManage: boolean;
}) {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<ChipId>("todos");
  const [verHist, setVerHist] = useState<Record<string, boolean>>({});

  const grupos = useMemo(() => agrupar(mandatos), [mandatos]);

  // Representantes em exercício ainda SEM posse (alvo da posse coletiva).
  const aguardandoPosse = mandatos.filter(
    (m) => (m.situacao === "ATIVO" || m.situacao === "AFASTADO") && !m.posseEm,
  ).length;

  const comVaga = grupos.filter((g) => g.vagasAbertas > 0).length;
  const comAfastado = grupos.filter((g) => g.afastados.length > 0).length;

  const tokens = searchTokens(q);
  const visiveis = grupos.filter((g) => {
    const texto =
      tokens.length === 0 ||
      searchScore(`${g.localNome} ${g.orgao} ${g.zona}`, tokens) > 0;
    const c =
      chip === "todos" ||
      (chip === "vaga_aberta" && g.vagasAbertas > 0) ||
      (chip === "afastados" && g.afastados.length > 0);
    return texto && c;
  });

  const totalVigentes = grupos.reduce(
    (s, g) => s + g.ativos.length + g.afastados.length,
    0,
  );

  const chips: { id: ChipId; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: grupos.length },
    { id: "vaga_aberta", label: "Vaga aberta", count: comVaga },
    { id: "afastados", label: "Com afastado", count: comAfastado },
  ];

  return (
    <div className="space-y-5">
      {/* Banner de homologação */}
      {aptos.length > 0 && (
        <Card className="border-sky-200 bg-sky-50/60">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {aptos.length} {aptos.length === 1 ? "local pronto" : "locais prontos"}{" "}
                  para homologar
                </p>
                <p className="text-sm text-muted-foreground">
                  Materialize os representantes (titulares e suplentes) para gerir o
                  mandato: posse, licença, renúncia e convocação de suplente.
                </p>
              </div>
            </div>
            {canManage ? (
              <div className="shrink-0">
                <HomologarTodosForm ano={ano} count={aptos.length} />
              </div>
            ) : (
              <p className="shrink-0 text-xs text-muted-foreground">
                Sem permissão para homologar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {canManage && aguardandoPosse > 0 && (
        <PosseColetivaCard ano={ano} pendentes={aguardandoPosse} />
      )}

      {grupos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/50" />
            <p className="max-w-md text-sm text-muted-foreground">
              Nenhum representante homologado ainda. Encerre as votações, resolva
              os empates e use <strong>Homologar</strong> para materializar os
              representantes do triênio.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumo + busca + chips */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm sm:px-5">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                <span className="text-xl font-bold leading-none">{totalVigentes}</span>
                <span className="text-xs text-muted-foreground">em exercício</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-slate-500" />
                <span className="text-xl font-bold leading-none">{grupos.length}</span>
                <span className="text-xs text-muted-foreground">locais com mandato</span>
              </div>
              {comVaga > 0 && (
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-amber-600" />
                  <span className="text-xl font-bold leading-none text-amber-700">
                    {comVaga}
                  </span>
                  <span className="text-xs text-muted-foreground">com vaga aberta</span>
                </div>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar local, órgão ou zona..."
                className="h-11 pl-9"
              />
            </div>

            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {chips
                .filter((c) => c.id === "todos" || c.count > 0)
                .map((c) => {
                  const ativo = chip === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChip(c.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        ativo
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {c.label}
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-[10px] font-bold",
                          ativo ? "bg-white/20" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {c.count}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Lista de locais */}
          <div className="grid gap-4 lg:grid-cols-2">
            {visiveis.map((g) => {
              const hist = verHist[g.workplaceId] ?? false;
              return (
                <Card key={g.workplaceId} className="overflow-hidden">
                  <CardContent className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight">{g.localNome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {g.orgao} · Zona {g.zona} · {g.seats}{" "}
                          {g.seats === 1 ? "cadeira" : "cadeiras"}
                        </p>
                      </div>
                      {g.vagasAbertas > 0 ? (
                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                          {g.vagasAbertas} vaga{g.vagasAbertas > 1 ? "s" : ""} aberta
                          {g.vagasAbertas > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                          Completo
                        </Badge>
                      )}
                    </div>

                    {/* Em exercício */}
                    <div className="divide-y rounded-lg border px-3">
                      {g.ativos.length === 0 && g.afastados.length === 0 ? (
                        <p className="py-3 text-sm text-muted-foreground">
                          Nenhum representante em exercício.
                        </p>
                      ) : (
                        <>
                          {g.ativos.map((m) => (
                            <HolderRow key={m.id} m={m} canManage={canManage} />
                          ))}
                          {g.afastados.map((m) => (
                            <HolderRow key={m.id} m={m} canManage={canManage} />
                          ))}
                        </>
                      )}
                    </div>

                    {/* Vaga aberta → convocar ou suplementar */}
                    {g.vagasAbertas > 0 && canManage && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                        <p className="mb-2 text-sm text-amber-800">
                          {g.vagasAbertas} vaga{g.vagasAbertas > 1 ? "s" : ""} aberta
                          {g.vagasAbertas > 1 ? "s" : ""}
                          {g.ultimaSaidaNome ? ` (saída de ${g.ultimaSaidaNome})` : ""}.
                        </p>
                        {g.reserva.length > 0 ? (
                          <ConvocarForm
                            workplaceId={g.workplaceId}
                            substituiuNome={g.ultimaSaidaNome}
                            proximoNome={g.reserva[0].nome}
                          />
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/locais/${g.workplaceId}`}>
                              <CalendarPlus className="mr-1.5 h-4 w-4" />
                              Sem suplente — abrir suplementar
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Suplência (reserva) */}
                    {g.reserva.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                          Suplência (ordem)
                        </p>
                        <p className="text-sm text-slate-600">
                          {g.reserva
                            .map((s, i) => `${i + 1}º ${s.nome} (${s.votosHomologados})`)
                            .join(" · ")}
                        </p>
                      </div>
                    )}

                    {/* Histórico de sucessão */}
                    {g.encerrados.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setVerHist((v) => ({
                              ...v,
                              [g.workplaceId]: !hist,
                            }))
                          }
                          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform",
                              hist && "rotate-180",
                            )}
                          />
                          Histórico de sucessão ({g.encerrados.length})
                        </button>
                        {hist && (
                          <ul className="mt-2 space-y-1.5 border-l-2 border-slate-200 pl-3 text-xs text-muted-foreground">
                            {g.encerrados.map((m) => (
                              <li key={m.id} className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-slate-700">
                                  {m.nome}
                                </span>
                                <span>
                                  saiu em {dataCurta(m.saidaEm)} —{" "}
                                  {m.saidaMotivo ? MOTIVO_LABEL[m.saidaMotivo] : "—"}
                                </span>
                                {canManage && (
                                  <ReverterForm id={m.id} label="Reabrir" />
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Desfazer homologação (só se intocado) */}
                    {canManage && g.intocado && (
                      <div className="flex justify-end">
                        <DesfazerHomologarForm workplaceId={g.workplaceId} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {visiveis.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum local corresponde ao filtro.
            </p>
          )}
        </>
      )}
    </div>
  );
}
