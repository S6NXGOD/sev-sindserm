"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { updateMyProfile } from "@/lib/actions/profile";
import { initialActionState } from "@/lib/types";
import { PhotoInput } from "@/components/admin/photo-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Salvar perfil
    </Button>
  );
}

/** Edição do PRÓPRIO perfil: foto + nome de exibição. */
export function ProfileForm({
  nome: nomeInicial,
  username,
  fotoUrl,
}: {
  nome: string;
  username: string;
  fotoUrl: string | null;
}) {
  const [state, formAction] = useFormState(updateMyProfile, initialActionState);
  const [nome, setNome] = useState(nomeInicial);
  const [foto, setFoto] = useState<string | null>(fotoUrl);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.refresh(); // atualiza o avatar no cabeçalho/sidebar
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="fotoUrl" value={foto ?? ""} />
      <PhotoInput nome={nome} value={foto} onChange={setFoto} />

      <div className="space-y-1.5">
        <Label htmlFor="pf-nome">Nome de exibição</Label>
        <Input
          id="pf-nome"
          name="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Usuário (login)</Label>
        <Input value={`@${username}`} disabled />
        <p className="text-xs text-muted-foreground">
          O login não pode ser alterado. Fale com o Administrador Geral se precisar.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
