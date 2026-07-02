"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { updateWorkplace } from "@/lib/actions/admin";
import { initialActionState } from "@/lib/types";
import { ORGAOS, ZONAS } from "@/lib/constants";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";

const ORGAO_OPTIONS = ORGAOS.map((o) => ({ value: o, label: o }));

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Salvar alterações
    </Button>
  );
}

/**
 * Edição dos DADOS CADASTRAIS do local (nome, órgão, zona) num diálogo
 * Mobile-First. O link (slug), os horários, o limite de votos e os candidatos
 * continuam sendo editados nas suas próprias seções da página — evitando
 * duplicidade e mantendo a consistência.
 */
export function EditWorkplaceForm({
  id,
  nome: nomeInicial,
  orgao: orgaoInicial,
  zona: zonaInicial,
}: {
  id: string;
  nome: string;
  orgao: string;
  zona: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(updateWorkplace, initialActionState);
  const [nome, setNome] = useState(nomeInicial);
  const [orgao, setOrgao] = useState(orgaoInicial);
  const [zona, setZona] = useState(zonaInicial);

  // Ao abrir, ressincroniza com os valores atuais (caso tenham mudado).
  useEffect(() => {
    if (open) {
      setNome(nomeInicial);
      setOrgao(orgaoInicial);
      setZona(zonaInicial);
    }
  }, [open, nomeInicial, orgaoInicial, zonaInicial]);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
      router.refresh();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Editar dados
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar dados do local</DialogTitle>
          <DialogDescription>
            Atualize as informações cadastrais. O link, os horários, o limite de
            votos e os candidatos são editados nas seções da página.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          {/* Selects não enviam valor nativo — espelhamos em inputs ocultos. */}
          <input type="hidden" name="orgao" value={orgao} />
          <input type="hidden" name="zona" value={zona} />

          <div className="space-y-2">
            <Label htmlFor="edit-nome">Nome do local *</Label>
            <Input
              id="edit-nome"
              name="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Escola Municipal Dom Barreto"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-orgao">Órgão *</Label>
              <Combobox
                id="edit-orgao"
                value={orgao}
                onChange={setOrgao}
                options={ORGAO_OPTIONS}
                placeholder="Selecione o órgão"
                searchPlaceholder="Buscar órgão..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-zona">Zona *</Label>
              <Select value={zona} onValueChange={setZona}>
                <SelectTrigger id="edit-zona">
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
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <SaveButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
