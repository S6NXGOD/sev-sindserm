"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createWorkplace } from "@/lib/actions/admin";
import { initialActionState } from "@/lib/types";
import { ORGAOS, ZONAS } from "@/lib/constants";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Vote } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      Cadastrar local
    </Button>
  );
}

export function CreateWorkplaceForm({
  anoEleicao,
  trienio,
}: {
  /** Pleito (ano) selecionado na sidebar — contexto obrigatório do cadastro. */
  anoEleicao: number;
  trienio: string;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(createWorkplace, initialActionState);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [zona, setZona] = useState("");
  const [orgao, setOrgao] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [limite, setLimite] = useState("");

  // Sugere o slug a partir do nome enquanto o usuário não editar manualmente.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(nome));
  }, [nome, slugTouched]);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.push("/admin");
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-5">
      {/* Contexto OBRIGATÓRIO do pleito (injetado a partir da sidebar). */}
      <input type="hidden" name="anoEleicao" value={anoEleicao} />
      <input type="hidden" name="zona" value={zona} />
      <input type="hidden" name="orgao" value={orgao} />
      <input
        type="hidden"
        name="voteLimit"
        value={unlimited ? "ilimitado" : limite}
      />

      {/* Vínculo visual: deixa explícito em qual pleito o local será criado. */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-slate-50 px-3 py-2">
        <Badge variant="secondary" className="gap-1.5">
          <Vote className="h-3.5 w-3.5" />
          Vínculo: Pleito {anoEleicao}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Triênio {trienio} · o local será cadastrado neste pleito.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do local *</Label>
          <Input
            id="nome"
            name="nome"
            placeholder="Ex.: Escola Municipal Dom Barreto"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="orgao">Órgão *</Label>
          <Select value={orgao} onValueChange={setOrgao}>
            <SelectTrigger id="orgao">
              <SelectValue placeholder="Selecione o órgão" />
            </SelectTrigger>
            <SelectContent>
              {ORGAOS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zona">Zona *</Label>
          <Select value={zona} onValueChange={setZona}>
            <SelectTrigger id="zona">
              <SelectValue placeholder="Selecione a zona" />
            </SelectTrigger>
            <SelectContent>
              {ZONAS.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Link público (slug) *</Label>
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="escola-municipal-dom-barreto"
            required
          />
          <p className="text-xs text-muted-foreground">
            Sugerido a partir do nome. URL final:{" "}
            <span className="font-mono">/votacao/{slug || "..."}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dataInicioVotacao">Início da votação *</Label>
          <Input
            id="dataInicioVotacao"
            name="dataInicioVotacao"
            type="datetime-local"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataFimVotacao">Fim da votação *</Label>
          <Input
            id="dataFimVotacao"
            name="dataFimVotacao"
            type="datetime-local"
            required
          />
        </div>
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <Label>Limite de votos do local</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            id="ilimitado"
            checked={unlimited}
            onCheckedChange={(c) => setUnlimited(Boolean(c))}
          />
          <Label htmlFor="ilimitado" className="font-normal">
            Ilimitado
          </Label>
        </div>
        {!unlimited && (
          <Input
            type="number"
            min={1}
            step={1}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="Ex.: 150"
            className="max-w-[200px]"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Quando o limite é atingido, novos votos são recusados.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
