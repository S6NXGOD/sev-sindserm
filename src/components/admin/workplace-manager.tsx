"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Download,
  FileText,
  Gauge,
  LinkIcon,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  createCandidate,
  deleteCandidate,
  deleteWorkplace,
  encerrarVotacao,
  reopenWorkplace,
  updateSlug,
  updateVoteLimit,
  updateWorkplaceSchedule,
} from "@/lib/actions/admin";
import { initialActionState } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/admin/copy-button";
import { ImportCandidates } from "@/components/admin/import-candidates";
import { EditWorkplaceForm } from "@/components/admin/edit-workplace-form";
import { downloadLocalReportPdf } from "@/lib/local-report-pdf";

export type ManagerCandidate = { id: string; nome: string; votes: number };
export type ManagerVoter = { id: string; nome: string; horario: string };
export type Apurado = { id: string; nome: string; votos: number };
export type RankingItem = { id: string; nome: string; votos: number; pct: number };

export type ManagerData = {
  id: string;
  nome: string;
  orgao: string;
  zona: string;
  slug: string;
  status: "upcoming" | "open" | "closed";
  inicioLocal: string;
  fimLocal: string;
  inicioDisplay: string;
  fimDisplay: string;
  totalVotes: number;
  voteLimit: number | null;
  publicUrl: string;

  // Apuração (agregada no servidor)
  totalCandidatos: number;
  vagas: number;
  eleitos: Apurado[];
  empatados: Apurado[];
  vagasEmDisputa: number;
  temEmpate: boolean;
  eleitosIds: string[];
  ranking: RankingItem[]; // top N para o gráfico de barras

  // Gestão de candidatos (paginada/buscável)
  candidates: ManagerCandidate[]; // página atual (<= candPageSize)
  candTotal: number;
  candPage: number;
  candPageSize: number;
  candQuery: string;

  // Votantes (limitado aos mais recentes)
  voters: ManagerVoter[];
  votersTotal: number;
};

const STATUS_META: Record<
  ManagerData["status"],
  { label: string; variant: "success" | "secondary" | "destructive" }
> = {
  open: { label: "Votação aberta", variant: "success" },
  upcoming: { label: "Não iniciada", variant: "secondary" },
  closed: { label: "Encerrada", variant: "destructive" },
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

function useToastState(state: { status: string; message: string }) {
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    else if (state.status === "error") toast.error(state.message);
  }, [state]);
}

function SlugForm({ data }: { data: ManagerData }) {
  const [state, formAction] = useFormState(updateSlug, initialActionState);
  const [slug, setSlug] = useState(data.slug);
  useToastState(state);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={data.id} />
      <Label htmlFor="slug" className="text-xs uppercase text-muted-foreground">
        Slug do link público
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
          className="flex-1 font-mono text-sm"
        />
        <PendingButton type="submit" size="sm" variant="secondary">
          Salvar slug
        </PendingButton>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Input
          readOnly
          value={data.publicUrl}
          className="flex-1 font-mono text-xs text-muted-foreground"
        />
        <CopyButton value={data.publicUrl} />
      </div>
    </form>
  );
}

function ScheduleForm({ data }: { data: ManagerData }) {
  const [state, formAction] = useFormState(
    updateWorkplaceSchedule,
    initialActionState,
  );
  useToastState(state);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={data.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="inicio" className="text-xs">
            Início da votação
          </Label>
          <Input
            id="inicio"
            name="dataInicioVotacao"
            type="datetime-local"
            defaultValue={data.inicioLocal}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fim" className="text-xs">
            Fim da votação
          </Label>
          <Input
            id="fim"
            name="dataFimVotacao"
            type="datetime-local"
            defaultValue={data.fimLocal}
          />
        </div>
      </div>
      <PendingButton type="submit" size="sm" variant="secondary">
        Salvar horário
      </PendingButton>
    </form>
  );
}

function VoteLimitForm({ data }: { data: ManagerData }) {
  const [state, formAction] = useFormState(updateVoteLimit, initialActionState);
  const [unlimited, setUnlimited] = useState(data.voteLimit === null);
  const [limite, setLimite] = useState(
    data.voteLimit !== null ? String(data.voteLimit) : "",
  );
  useToastState(state);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={data.id} />
      <input
        type="hidden"
        name="voteLimit"
        value={unlimited ? "ilimitado" : limite}
      />
      <div className="flex items-center gap-2 text-sm font-medium">
        <Gauge className="h-4 w-4" />
        Limite de votos
        {data.voteLimit !== null && (
          <Badge variant="outline">
            {data.totalVotes}/{data.voteLimit}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`ilimitado-${data.id}`}
          checked={unlimited}
          onCheckedChange={(c) => setUnlimited(Boolean(c))}
        />
        <Label htmlFor={`ilimitado-${data.id}`} className="font-normal">
          Ilimitado
        </Label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {!unlimited && (
          <Input
            type="number"
            min={1}
            step={1}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="Ex.: 150"
            className="max-w-[160px]"
          />
        )}
        <PendingButton type="submit" size="sm" variant="secondary">
          Salvar limite
        </PendingButton>
      </div>
    </form>
  );
}

function EncerrarVotacaoButton({ data }: { data: ManagerData }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Ban className="mr-2 h-4 w-4" />
          Encerrar votação agora
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar votação manualmente</DialogTitle>
          <DialogDescription>
            A votação de <strong>{data.nome}</strong> será encerrada{" "}
            <strong>imediatamente</strong>, mesmo antes do horário previsto.
            Novos votos não serão mais aceitos. Você poderá reabri-la depois, se
            necessário.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <form action={encerrarVotacao}>
            <input type="hidden" name="id" value={data.id} />
            <PendingButton type="submit" variant="destructive">
              Encerrar agora
            </PendingButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReopenForm({ data }: { data: ManagerData }) {
  const [state, formAction] = useFormState(reopenWorkplace, initialActionState);
  useToastState(state);

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
        <RotateCcw className="h-4 w-4" />
        Reabrir votação encerrada
      </div>
      <p className="mb-3 text-xs text-amber-700">
        Defina um novo horário de término no futuro. A votação voltará a aceitar
        votos imediatamente.
      </p>
      <form
        action={formAction}
        className="flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="id" value={data.id} />
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="novoFim" className="text-xs">
            Novo término
          </Label>
          <Input id="novoFim" name="novoFim" type="datetime-local" required />
        </div>
        <PendingButton type="submit" size="sm">
          Reabrir votação
        </PendingButton>
      </form>
    </div>
  );
}

function CandidateRow({
  candidate,
  eleito,
  closed,
}: {
  candidate: ManagerCandidate;
  eleito?: boolean;
  closed?: boolean;
}) {
  const [state, formAction] = useFormState(deleteCandidate, initialActionState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
    } else if (state.status === "error") {
      toast.error(state.message);
      setOpen(false);
    }
  }, [state]);

  return (
    <li className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        {candidate.nome}
        {eleito && (
          <Badge variant={closed ? "success" : "secondary"} className="gap-1">
            <Crown className="h-3 w-3" />
            {closed ? "Eleito" : "Eleito (parcial)"}
          </Badge>
        )}
      </span>
      <div className="flex items-center gap-3">
        <Badge variant="outline">
          {candidate.votes} {candidate.votes === 1 ? "voto" : "votos"}
        </Badge>
        {candidate.votes === 0 ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Remover candidato"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir candidato</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir{" "}
                  <strong>{candidate.nome}</strong>? Esta ação não pode ser
                  desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <form action={formAction}>
                  <input type="hidden" name="id" value={candidate.id} />
                  <PendingButton type="submit" variant="destructive">
                    Excluir
                  </PendingButton>
                </form>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <span
            className="cursor-not-allowed text-slate-300"
            title="Não é possível excluir: já possui votos"
          >
            <Trash2 className="h-4 w-4" />
          </span>
        )}
      </div>
    </li>
  );
}

function AddCandidateForm({ workplaceId }: { workplaceId: string }) {
  const [state, formAction] = useFormState(createCandidate, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="workplaceId" value={workplaceId} />
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="novoCandidato" className="text-xs">
          Novo candidato
        </Label>
        <Input
          id="novoCandidato"
          name="nome"
          placeholder="Nome do candidato"
          required
        />
      </div>
      <PendingButton type="submit" size="sm">
        <Plus className="mr-1 h-4 w-4" />
        Adicionar
      </PendingButton>
    </form>
  );
}

/** Busca de candidatos (server-side) via parâmetros de URL: cq, cpage. */
function CandidateSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(initial);

  useEffect(() => {
    setQ(initial);
  }, [initial]);

  useEffect(() => {
    const atual = searchParams.get("cq") ?? "";
    if (q === atual) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("cq", q);
      else params.delete("cq");
      params.delete("cpage");
      startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar candidato por nome..."
        className="pl-9"
      />
    </div>
  );
}

/** Paginação dos candidatos via parâmetro cpage (preserva cq). */
function CandidatePagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function href(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("cpage", String(p));
    return `?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-between pt-1">
      <p className="text-xs text-muted-foreground">
        Página {page} de {totalPages} · {total} candidato(s)
      </p>
      <div className="flex gap-2">
        <Button
          asChild={page > 1}
          variant="outline"
          size="sm"
          disabled={page <= 1}
        >
          {page > 1 ? (
            <Link href={href(page - 1)} scroll={false}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span>
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
        </Button>
        <Button
          asChild={page < totalPages}
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
        >
          {page < totalPages ? (
            <Link href={href(page + 1)} scroll={false}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Exclusão do local. Sem votos: confirmação simples. Com votos: alerta forte +
 * exige digitar o NOME EXATO do local (mesma checagem é feita no servidor).
 */
function DeleteWorkplaceButton({ data }: { data: ManagerData }) {
  const [state, formAction] = useFormState(deleteWorkplace, initialActionState);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const temVotos = data.totalVotes > 0;
  const podeExcluir = !temVotos || confirmText.trim() === data.nome.trim();

  useEffect(() => {
    // Sucesso → a action redireciona para a lista (não retorna estado).
    if (state.status === "error") toast.error(state.message);
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
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir local
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Excluir “{data.nome}”
          </DialogTitle>
          <DialogDescription>
            {temVotos
              ? "Atenção: este local já possui votos computados."
              : "O local e o seu link público serão apagados permanentemente. Esta ação não pode ser desfeita."}
          </DialogDescription>
        </DialogHeader>

        {temVotos && (
          <div className="space-y-3">
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                A exclusão é <strong>permanente</strong> e remove{" "}
                <strong>{data.totalVotes}</strong>{" "}
                {data.totalVotes === 1 ? "voto" : "votos"},{" "}
                <strong>{data.votersTotal}</strong>{" "}
                {data.votersTotal === 1 ? "votante" : "votantes"},{" "}
                <strong>{data.totalCandidatos}</strong>{" "}
                {data.totalCandidatos === 1 ? "candidato" : "candidatos"} e o
                link público. Não há como desfazer.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmacao-exclusao">
                Para confirmar, digite o nome do local:{" "}
                <span className="font-semibold">{data.nome}</span>
              </Label>
              <Input
                id="confirmacao-exclusao"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={data.nome}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <form action={formAction}>
            <input type="hidden" name="id" value={data.id} />
            <input type="hidden" name="confirmacao" value={confirmText} />
            <PendingButton
              type="submit"
              variant="destructive"
              disabled={!podeExcluir}
            >
              {temVotos ? "Excluir definitivamente" : "Excluir"}
            </PendingButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkplaceManager({ data }: { data: ManagerData }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  async function baixarPdf() {
    setPdfLoading(true);
    try {
      await downloadLocalReportPdf(data);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setPdfLoading(false);
    }
  }

  const status = STATUS_META[data.status];
  const isClosed = data.status === "closed";
  const eleitosIds = new Set(data.eleitosIds);
  const empatadosIds = new Set(data.empatados.map((c) => c.id));
  const maxVotes = Math.max(1, ...data.ranking.map((c) => c.votos));
  const houveApuracao = data.eleitos.length > 0 || data.empatados.length > 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho + apuração */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{data.nome}</CardTitle>
              <CardDescription>
                {data.orgao} · Zona {data.zona}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EditWorkplaceForm
                id={data.id}
                nome={data.nome}
                orgao={data.orgao}
                zona={data.zona}
              />
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/relatorios?tipo=local&localId=${data.id}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Relatório
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={baixarPdf}
                disabled={pdfLoading}
              >
                {pdfLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                PDF
              </Button>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              Janela de votação: {data.inicioDisplay} até {data.fimDisplay}
            </p>
            <Badge variant="outline">
              {data.totalCandidatos} candidato(s) · {data.vagas}{" "}
              {data.vagas === 1 ? "vaga" : "vagas"}
            </Badge>
          </div>

          {houveApuracao ? (
            <div
              className={`space-y-2 rounded-md border p-3 ${
                isClosed
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <Crown
                  className={`h-5 w-5 ${
                    isClosed ? "text-emerald-600" : "text-slate-500"
                  }`}
                />
                {isClosed
                  ? `Eleito(s) — ${data.vagas} ${data.vagas === 1 ? "vaga" : "vagas"}`
                  : `Parcial — ${data.vagas} ${data.vagas === 1 ? "vaga" : "vagas"} (projeção)`}
              </div>
              {data.eleitos.length > 0 ? (
                <ol className="ml-6 max-h-48 list-decimal space-y-0.5 overflow-auto">
                  {data.eleitos.map((c) => (
                    <li key={c.id}>
                      <span className="font-medium">{c.nome}</span> — {c.votos}{" "}
                      {c.votos === 1 ? "voto" : "votos"}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="ml-6">
                  Nenhum eleito definido — todas as vagas estão em disputa por
                  empate.
                </p>
              )}
              {data.temEmpate && (
                <p className="ml-6 rounded bg-amber-100 px-2 py-1 text-amber-800">
                  <strong>Empate</strong> para {data.vagasEmDisputa}{" "}
                  {data.vagasEmDisputa === 1 ? "vaga" : "vagas"} entre:{" "}
                  {data.empatados.map((c) => c.nome).join(", ")} (
                  {data.empatados[0].votos} votos cada) — necessário desempate.
                </p>
              )}
            </div>
          ) : (
            isClosed && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
                Votação encerrada sem votos registrados.
              </p>
            )
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Link + horário + reabertura/encerramento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LinkIcon className="h-5 w-5" />
              Link e Horários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SlugForm data={data} />
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Janela de votação
              </div>
              <ScheduleForm data={data} />
            </div>
            <Separator />
            <VoteLimitForm data={data} />
            <Separator />
            {data.status === "closed" ? (
              <ReopenForm data={data} />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Ban className="h-4 w-4" />
                  Encerramento manual
                </div>
                <p className="text-xs text-muted-foreground">
                  Encerre a votação antes do horário previsto, se necessário.
                </p>
                <EncerrarVotacaoButton data={data} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Candidatos — busca + paginação no servidor */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Candidatos ({data.totalCandidatos})
                </CardTitle>
                <CardDescription>
                  Candidatos com votos não podem ser excluídos.
                </CardDescription>
              </div>
              <ImportCandidates workplaceId={data.id} workplaceNome={data.nome} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <CandidateSearch initial={data.candQuery} />

            {data.candidates.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {data.candQuery
                  ? "Nenhum candidato corresponde à busca."
                  : "Nenhum candidato cadastrado."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.candidates.map((c) => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    eleito={eleitosIds.has(c.id)}
                    closed={isClosed}
                  />
                ))}
              </ul>
            )}

            <CandidatePagination
              page={data.candPage}
              pageSize={data.candPageSize}
              total={data.candTotal}
            />

            <Separator />
            <AddCandidateForm workplaceId={data.id} />
          </CardContent>
        </Card>
      </div>

      {/* Resultados — ranking dos mais votados (agregado no servidor) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Resultados apurados</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {data.vagas} {data.vagas === 1 ? "vaga" : "vagas"}
              </Badge>
              <Badge variant="outline">
                {data.totalVotes} {data.totalVotes === 1 ? "voto" : "votos"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum voto registrado ainda.
            </p>
          ) : (
            <>
              <ul className="space-y-3">
                {data.ranking.map((c) => {
                  const eleito = eleitosIds.has(c.id);
                  const empatado = empatadosIds.has(c.id);
                  const suplente = !eleito && !empatado && c.votos > 0;
                  return (
                    <li key={c.id} className="space-y-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2">
                          {c.nome}
                          {eleito && (
                            <Badge
                              variant={isClosed ? "success" : "secondary"}
                              className="gap-1"
                            >
                              <Crown className="h-3 w-3" />
                              {isClosed ? "Eleito" : "Eleito (parcial)"}
                            </Badge>
                          )}
                          {empatado && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 text-amber-700"
                            >
                              Empate
                            </Badge>
                          )}
                          {suplente && (
                            <Badge
                              variant="outline"
                              className="border-sky-300 text-sky-700"
                            >
                              Suplente
                            </Badge>
                          )}
                        </span>
                        <span className="font-medium">
                          {c.votos} ({c.pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            eleito ? "bg-emerald-500" : "bg-primary"
                          }`}
                          style={{ width: `${(c.votos / maxVotes) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {data.totalCandidatos > data.ranking.length && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Mostrando os {data.ranking.length} mais votados de{" "}
                  {data.totalCandidatos} candidatos. Use a busca acima ou o
                  relatório para ver todos.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Lista de votantes (anônima quanto à escolha) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5" />
            Lista de votantes ({data.votersTotal})
          </CardTitle>
          <CardDescription>
            Registra apenas <strong>quem compareceu e quando</strong>. Não há
            qualquer vínculo com o voto escolhido — o sigilo é preservado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.voters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum voto registrado ainda.
            </p>
          ) : (
            <>
              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">
                        Votante
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        Horário do voto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.voters.map((v) => (
                      <tr key={v.id} className="border-t">
                        <td className="px-4 py-2">{v.nome}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {v.horario}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.votersTotal > data.voters.length && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Mostrando os {data.voters.length} mais recentes de{" "}
                  {data.votersTotal}. Veja a lista completa em{" "}
                  <Link href="/admin/votantes" className="underline">
                    Votantes
                  </Link>
                  .
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Zona de perigo — exclusão definitiva do local */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Zona de perigo
          </CardTitle>
          <CardDescription>
            Excluir o local remove permanentemente o link público, os candidatos,
            os votos e os votantes deste local. Esta ação não pode ser desfeita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteWorkplaceButton data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
