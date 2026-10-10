"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  CalendarPlus,
  ChevronDown,
  Gavel,
  Loader2,
  PartyPopper,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Undo2,
  Users,
} from "lucide-react";
import {
  afastarRepresentante,
  convocarSuplente,
  desfazerHomologacao,
  desfazerHomologacaoLote,
  empossarColetivo,
  homologarResultados,
  reativarRepresentante,
  registrarPosse,
  registrarVacancia,
  reverterMandato,
} from "@/lib/actions/mandato";
import { initialActionState, type ActionState } from "@/lib/types";
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

type ServerAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

function Pending({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** Toast + refresh ao concluir; callback opcional (fechar dialog). */
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

/**
 * Ação com MODAL DE CONFIRMAÇÃO (anti-acidente). O gatilho é um botão; ao
 * confirmar, submete a server action com os campos ocultos informados.
 */
function AcaoConfirm({
  trigger,
  titulo,
  descricao,
  confirmLabel,
  action,
  hidden,
  destrutivo = false,
}: {
  trigger: React.ReactNode;
  titulo: string;
  descricao: React.ReactNode;
  confirmLabel: string;
  action: ServerAction;
  hidden: Record<string, string | number>;
  destrutivo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(action, initialActionState);
  useActionToast(state, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Pending
              type="submit"
              className={destrutivo ? "bg-rose-600 hover:bg-rose-700" : undefined}
            >
              {confirmLabel}
            </Pending>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Posse coletiva ----------------------------- */

function PosseColetivaCard({ ano, pendentes }: { ano: number; pendentes: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(empossarColetivo, initialActionState);
  useActionToast(state, () => setOpen(false));
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <PartyPopper className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">Posse coletiva</p>
            <p className="text-sm text-muted-foreground">
              {pendentes} representante(s) aguardando posse — emposse todos de uma
              vez com a data da cerimônia.
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
              <DialogTitle>Confirmar posse coletiva</DialogTitle>
              <DialogDescription>
                Registra a MESMA data de posse para os {pendentes} representantes
                em exercício que ainda não foram empossados. Quem já tem posse não
                é alterado. Reversível por representante no “Gerenciar”.
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

function ReverterForm({ id, label }: { id: string; label: string }) {
  const [state, formAction] = useFormState(reverterMandato, initialActionState);
  useActionToast(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Pending
        type="submit"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
      >
        <Undo2 className="mr-1 h-3.5 w-3.5" />
        {label}
      </Pending>
    </form>
  );
}

/* ------------------- Gerenciar UM representante (dialog) ------------------ */

function GerenciarDialog({ m }: { m: MandatoLinha }) {
  const [open, setOpen] = useState(false);
  const fechar = () => setOpen(false);

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
        <Button size="sm" variant="ghost" className="h-8 shrink-0 px-2 text-slate-600">
          <Settings2 className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Gerenciar</span>
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
          <form action={posAction} className="space-y-2">
            <Label
              htmlFor={`posse-${m.id}`}
              className="text-xs font-semibold uppercase text-muted-foreground"
            >
              Posse {m.posseEm ? `(registrada em ${dataCurta(m.posseEm)})` : ""}
            </Label>
            <div className="flex gap-2">
              <input type="hidden" name="id" value={m.id} />
              <Input
                id={`posse-${m.id}`}
                name="data"
                type="date"
                defaultValue={hoje}
                className="h-9"
              />
              <Pending type="submit" size="sm" variant="outline">
                <UserCheck className="mr-1.5 h-4 w-4" />
                Registrar posse
              </Pending>
            </div>
          </form>

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
              <Label
                htmlFor={`afa-${m.id}`}
                className="text-xs font-semibold uppercase text-muted-foreground"
              >
                Afastar (licença temporária)
              </Label>
              <input type="hidden" name="id" value={m.id} />
              <Input
                id={`afa-${m.id}`}
                name="observacao"
                placeholder="Ex.: licença-saúde até 30/11 (opcional)"
                className="h-9"
              />
              <Pending type="submit" size="sm" variant="outline">
                <UserMinus className="mr-1.5 h-4 w-4" />
                Afastar
              </Pending>
            </form>
          )}

          <form
            action={vacAction}
            className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/50 p-3"
          >
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
      .sort((a, b) => (b.saidaEm?.getTime() ?? 0) - (a.saidaEm?.getTime() ?? 0));
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

function HolderRow({ m, canManage }: { m: MandatoLinha; canManage: boolean }) {
  const convocado = m.papel === "SUPLENTE" && m.assumiuEm != null;
  const afastado = m.situacao === "AFASTADO";

  // Cor do "selo" por situação (titular verde, convocado azul, afastado âmbar).
  const corIcone = afastado
    ? "bg-amber-100 text-amber-700"
    : convocado
      ? "bg-sky-100 text-sky-700"
      : "bg-emerald-100 text-emerald-700";
  const tag = afastado
    ? { txt: "Afastado", cls: "bg-amber-50 text-amber-700 ring-amber-200" }
    : convocado
      ? { txt: "Suplente convocado", cls: "bg-sky-50 text-sky-700 ring-sky-200" }
      : { txt: "Titular", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold",
          corIcone,
        )}
      >
        {m.nome.trim().charAt(0).toUpperCase() || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-semibold text-slate-800">
            {m.nome}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
              tag.cls,
            )}
          >
            {tag.txt}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {m.votosHomologados} voto(s)
          {m.posseEm ? ` · posse ${dataCurta(m.posseEm)}` : ""}
          {m.substituiuNome ? ` · no lugar de ${m.substituiuNome}` : ""}
        </p>
      </div>
      {canManage && <GerenciarDialog m={m} />}
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

  const aguardandoPosse = mandatos.filter(
    (m) => (m.situacao === "ATIVO" || m.situacao === "AFASTADO") && !m.posseEm,
  ).length;
  const comVaga = grupos.filter((g) => g.vagasAbertas > 0).length;
  const comAfastado = grupos.filter((g) => g.afastados.length > 0).length;
  const intocados = grupos.filter((g) => g.intocado).length;

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
      {/* Banner de homologação (com modal de confirmação) */}
      {aptos.length > 0 && (
        <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {aptos.length}{" "}
                  {aptos.length === 1 ? "local pronto" : "locais prontos"} para
                  homologar
                </p>
                <p className="text-sm text-muted-foreground">
                  Transforme o resultado em representantes para gerir o mandato
                  (posse, licença, renúncia e convocação de suplente).
                </p>
              </div>
            </div>
            {canManage ? (
              <AcaoConfirm
                action={homologarResultados}
                hidden={{ ano }}
                titulo={`Homologar ${aptos.length} ${aptos.length === 1 ? "local" : "locais"}?`}
                descricao="Materializa os representantes (titulares + suplentes) destes locais. Locais com empate ou sem eleito são ignorados. É reversível enquanto nada for registrado."
                confirmLabel="Confirmar homologação"
                trigger={
                  <Button className="shrink-0">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Homologar {aptos.length}
                  </Button>
                }
              />
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
            <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
            <p className="max-w-md text-sm text-muted-foreground">
              Nenhum representante homologado ainda. Encerre as votações, resolva
              os empates e use <strong>Homologar</strong> para materializar os
              representantes do triênio.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumo (métricas) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResumoTile
              icon={<UserCheck className="h-5 w-5" />}
              tone="emerald"
              value={totalVigentes}
              label="em exercício"
            />
            <ResumoTile
              icon={<Users className="h-5 w-5" />}
              tone="slate"
              value={grupos.length}
              label="locais com mandato"
            />
            <ResumoTile
              icon={<UserPlus className="h-5 w-5" />}
              tone="amber"
              value={comVaga}
              label="com vaga aberta"
            />
            <ResumoTile
              icon={<PartyPopper className="h-5 w-5" />}
              tone="sky"
              value={aguardandoPosse}
              label="aguardando posse"
            />
          </div>

          {/* Busca + chips + desfazer em lote */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar local, órgão ou zona..."
                className="h-11 pl-9"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
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

              {canManage && intocados > 0 && (
                <AcaoConfirm
                  action={desfazerHomologacaoLote}
                  hidden={{ ano }}
                  destrutivo
                  titulo="Desfazer homologação em lote?"
                  descricao={
                    <>
                      Remove os representantes de <strong>{intocados}</strong>{" "}
                      local(is) <strong>intocado(s)</strong> (sem posse, vacância
                      ou convocação). Locais com histórico são preservados. Isto
                      não afeta outros pleitos — mandatos são isolados por ano.
                    </>
                  }
                  confirmLabel={`Desfazer ${intocados} local(is)`}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-slate-500"
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      <span className="hidden sm:inline">Desfazer em lote</span>
                    </Button>
                  }
                />
              )}
            </div>
          </div>

          {/* Lista de locais */}
          <div className="grid gap-4 lg:grid-cols-2">
            {visiveis.map((g) => {
              const hist = verHist[g.workplaceId] ?? false;
              return (
                <Card key={g.workplaceId} className="flex flex-col overflow-hidden">
                  <CardContent className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight text-slate-900">
                          {g.localNome}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {g.orgao} · Zona {g.zona} · {g.seats}{" "}
                          {g.seats === 1 ? "cadeira" : "cadeiras"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                          g.vagasAbertas > 0
                            ? "bg-amber-50 text-amber-700 ring-amber-200"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                        )}
                      >
                        {g.vagasAbertas > 0
                          ? `${g.vagasAbertas} vaga${g.vagasAbertas > 1 ? "s" : ""}`
                          : "Completo"}
                      </span>
                    </div>

                    {/* Em exercício */}
                    <div className="divide-y rounded-lg border">
                      {g.ativos.length === 0 && g.afastados.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
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
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Próximos suplentes
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {g.reserva.slice(0, 6).map((s, i) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200"
                            >
                              <span className="font-bold text-slate-400">{i + 1}º</span>
                              {s.nome}
                            </span>
                          ))}
                          {g.reserva.length > 6 && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs text-slate-400">
                              +{g.reserva.length - 6}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Histórico de sucessão */}
                    {g.encerrados.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setVerHist((v) => ({ ...v, [g.workplaceId]: !hist }))
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
                              <li
                                key={m.id}
                                className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                              >
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

                    {/* Rodapé: desfazer homologação do local (só se intocado) */}
                    {canManage && g.intocado && (
                      <div className="mt-auto flex justify-end border-t pt-2">
                        <AcaoConfirm
                          action={desfazerHomologacao}
                          hidden={{ workplaceId: g.workplaceId }}
                          destrutivo
                          titulo="Desfazer homologação deste local?"
                          descricao={
                            <>
                              Remove os representantes de{" "}
                              <strong>{g.localNome}</strong>. Só é possível porque
                              nada foi registrado ainda (posse/vacância/convocação).
                            </>
                          }
                          confirmLabel="Desfazer"
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-slate-400 hover:text-slate-600"
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                              Desfazer homologação
                            </Button>
                          }
                        />
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

/* --------------------------------- Tile ---------------------------------- */

function ResumoTile({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: "emerald" | "slate" | "amber" | "sky";
  value: number;
  label: string;
}) {
  const cls = {
    emerald: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm sm:p-4">
      <span className={cn("shrink-0 rounded-lg p-2", cls)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-xs leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
