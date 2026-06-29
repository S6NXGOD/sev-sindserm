"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { updateElection } from "@/lib/actions/config";
import { initialActionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TITULO_BASE = "Eleição de Representantes de Base";

/** Título institucional (mesma regra do backend, espelhada no cliente). */
function tituloInstitucional(base: string, ano: number, duracao: number) {
  const limpo = base.replace(/\s*[-–]\s*Tri[êe]nio.*$/i, "").trim() || TITULO_BASE;
  return `${limpo} - Triênio ${ano}-${ano + duracao}`;
}

export type EditElectionData = {
  id: string;
  ano: number;
  titulo: string;
  duracaoMandato: number;
  status: string;
  isEleicaoEspecial: boolean;
  emailOficial: string;
  // Pré-formatadas no servidor para o input datetime-local (ou "").
  dataInicioGeral: string;
  dataFimGeral: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Salvar alterações
    </Button>
  );
}

export function EditElectionForm({ election }: { election: EditElectionData }) {
  const router = useRouter();
  const [state, formAction] = useFormState(updateElection, initialActionState);
  const [titulo, setTitulo] = useState(election.titulo);
  const [duracao, setDuracao] = useState(String(election.duracaoMandato));
  const [status, setStatus] = useState(election.status);
  const [isEspecial, setIsEspecial] = useState(election.isEleicaoEspecial);

  const duracaoNum = Number(duracao) || 3;
  const preview = useMemo(
    () => tituloInstitucional(titulo, election.ano, duracaoNum),
    [titulo, election.ano, duracaoNum],
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.push("/admin/pleitos");
      router.refresh();
    } else if (state.status === "warning") {
      // Salvou, mas com impacto: alerta o admin (datas mexidas + votos existentes).
      toast.warning(state.message, { duration: 8000 });
      router.push("/admin/pleitos");
      router.refresh();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={election.id} />
      {/* Campos controlados (Select/Checkbox do Radix não enviam valor nativo) */}
      <input type="hidden" name="status" value={status} />
      <input
        type="hidden"
        name="isEleicaoEspecial"
        value={isEspecial ? "true" : "false"}
      />

      <div className="grid gap-4 sm:grid-cols-6">
        <div className="space-y-2 sm:col-span-4">
          <Label htmlFor="titulo">Título do pleito *</Label>
          <Input
            id="titulo"
            name="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={TITULO_BASE}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="ano">Ano</Label>
          {/* Ano é a chave lógica do pleito (liga locais/votantes/votos): não editável. */}
          <Input id="ano" value={election.ano} disabled readOnly />
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="duracaoMandato">Mandato (anos) *</Label>
          <Input
            id="duracaoMandato"
            name="duracaoMandato"
            type="number"
            min={1}
            max={10}
            step={1}
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Título institucional: </span>
        <strong>{preview}</strong>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dataInicioGeral">Início geral da votação</Label>
          <Input
            id="dataInicioGeral"
            name="dataInicioGeral"
            type="datetime-local"
            defaultValue={election.dataInicioGeral}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataFimGeral">Encerramento geral da votação</Label>
          <Input
            id="dataFimGeral"
            name="dataFimGeral"
            type="datetime-local"
            defaultValue={election.dataFimGeral}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Janela geral do pleito. Fora dela (ou com status diferente de “Ativo”), o
        sistema bloqueia novos votos, independentemente da janela de cada local.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="emailOficial">E-mail oficial</Label>
          <Input
            id="emailOficial"
            name="emailOficial"
            type="email"
            defaultValue={election.emailOficial}
            placeholder="eleicao@sindserm.org.br"
          />
          <p className="text-xs text-muted-foreground">
            Exibido nas instruções/rodapés (ex.: envio de atas).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Situação *</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVO">Ativo (aceita votos)</SelectItem>
              <SelectItem value="RASCUNHO">Rascunho (sem votos)</SelectItem>
              <SelectItem value="ENCERRADO">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
        <Checkbox
          id="isEleicaoEspecial"
          checked={isEspecial}
          onCheckedChange={(v) => setIsEspecial(v === true)}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <Label htmlFor="isEleicaoEspecial" className="cursor-pointer">
            Eleição Especial/Suplementar
          </Label>
          <p className="text-xs text-muted-foreground">
            Ignora a trava anti-conflito de ano. Desmarque apenas se este for o
            pleito regular do ano {election.ano} (não pode haver dois regulares).
          </p>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
