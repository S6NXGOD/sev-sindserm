"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createElection } from "@/lib/actions/config";
import { initialActionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LogoPickerField } from "@/components/admin/logo-picker-field";
import type { GalleryImage } from "@/lib/logo-constants";
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      Criar pleito
    </Button>
  );
}

export function CreateElectionForm({
  anoSugerido,
  images,
}: {
  anoSugerido: number;
  /** Imagens da Galeria de Mídia (carregadas no server e passadas por prop). */
  images: GalleryImage[];
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(createElection, initialActionState);
  const [ano, setAno] = useState(String(anoSugerido));
  const [titulo, setTitulo] = useState(TITULO_BASE);
  const [duracao, setDuracao] = useState("3");
  const [status, setStatus] = useState("ATIVO");
  const [isEspecial, setIsEspecial] = useState(false);

  const anoNum = Number(ano) || 0;
  const duracaoNum = Number(duracao) || 3;
  const preview = useMemo(
    () => tituloInstitucional(titulo, anoNum, duracaoNum),
    [titulo, anoNum, duracaoNum],
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.push("/admin/pleitos");
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-5" encType="multipart/form-data">
      {/* status entra como campo controlado (Select do Shadcn não é input nativo) */}
      <input type="hidden" name="status" value={status} />
      {/* Checkbox do Radix não envia valor nativo: espelhamos no hidden input */}
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
          <Label htmlFor="ano">Ano *</Label>
          <Input
            id="ano"
            name="ano"
            type="number"
            min={2000}
            max={3000}
            step={1}
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            required
          />
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataFimGeral">Encerramento geral da votação</Label>
          <Input id="dataFimGeral" name="dataFimGeral" type="datetime-local" />
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
            Marcar como Eleição Especial/Suplementar
          </Label>
          <p className="text-xs text-muted-foreground">
            Ignora a trava anti-conflito de ano: permite cadastrar este pleito
            mesmo que já exista um pleito regular para {anoNum || "o ano"}.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Logo do SINDSERM (opcional)</Label>
          {/* Galeria de mídia: reusa imagem anterior ou envia nova. Sem escolha,
              fica a logo padrão do sistema (DEFAULT_LOGO). */}
          <LogoPickerField
            name="logoSindserm"
            tipo="sindserm"
            images={images}
            helpText="Recomendado: ~600×180 px (horizontal), PNG com fundo transparente."
          />
        </div>
        <div className="space-y-2">
          <Label>Logo do Pleito (opcional)</Label>
          {/* Regra estrita: sem logo do pleito, o elemento é ocultado (sem fallback). */}
          <LogoPickerField
            name="logoPleito"
            tipo="pleito"
            images={images}
            helpText="Recomendado: ~400×400 px (quadrada), PNG com fundo transparente."
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        PNG, JPG, WEBP ou SVG · até 2 MB. O SINDSERM usa a logo padrão quando não
        houver escolha; o pleito fica sem logo (oculto) se nenhuma for definida.
      </p>

      <SubmitButton />
    </form>
  );
}
