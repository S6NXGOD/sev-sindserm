"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { castVote, type CandidateOption } from "@/lib/actions/votacao";
import { initialVoteActionState } from "@/lib/types";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { formatCpf } from "@/lib/cpf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CandidateCombobox } from "@/components/candidate-combobox";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Registrando voto...
        </>
      ) : (
        "Confirmar voto"
      )}
    </Button>
  );
}

export function VotingForm({ linkToken }: { linkToken: string }) {
  const [state, formAction] = useFormState(castVote, initialVoteActionState);
  const [cpf, setCpf] = useState("");
  const [candidate, setCandidate] = useState<CandidateOption | null>(null);
  const [filiado, setFiliado] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setCpf("");
      setCandidate(null);
      setFiliado("");
    }
  }, [state]);

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 className="h-16 w-16 text-emerald-600" />
        <h2 className="text-2xl font-semibold text-slate-900">
          Voto registrado!
        </h2>
        <p className="max-w-sm text-slate-600">{state.message}</p>

        {state.receipt && (
          <div className="mt-2 w-full max-w-sm space-y-3">
            <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Protocolo: </span>
              <span className="font-mono font-semibold">
                {state.receipt.protocolo}
              </span>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                void downloadReceiptPdf(state.receipt!);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar comprovante (PDF)
            </Button>
            <p className="text-xs text-muted-foreground">
              O comprovante atesta seu comparecimento. Ele <strong>não</strong>{" "}
              contém o candidato escolhido — seu voto é secreto.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <input type="hidden" name="linkToken" value={linkToken} />
      {/* candidato escolhido é controlado e enviado via hidden input */}
      <input type="hidden" name="candidateId" value={candidate?.id ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="nome">Nome completo *</Label>
        <Input id="nome" name="nome" required autoComplete="name" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cpf">CPF *</Label>
          <Input
            id="cpf"
            name="cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            maxLength={14}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="matricula">Matrícula da Prefeitura *</Label>
          <Input id="matricula" name="matricula" required />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            name="telefone"
            type="tel"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Candidato *</Label>
        <CandidateCombobox
          linkToken={linkToken}
          value={candidate}
          onChange={setCandidate}
        />
        <p className="text-xs text-muted-foreground">
          Comece a digitar o nome para buscar o candidato.
        </p>
      </div>

      {/* Filiação ao SINDSERM (obrigatório) */}
      <input type="hidden" name="isFiliado" value={filiado} />
      <div className="space-y-2">
        <Label>Você é filiado ao SINDSERM? *</Label>
        <RadioGroup
          value={filiado}
          onValueChange={setFiliado}
          className="grid gap-2 sm:grid-cols-2"
        >
          <Label
            htmlFor="filiado-sim"
            className="flex cursor-pointer items-center gap-3 rounded-md border bg-white p-3 font-normal hover:bg-slate-50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-slate-50"
          >
            <RadioGroupItem value="sim" id="filiado-sim" />
            Sim, sou filiado
          </Label>
          <Label
            htmlFor="filiado-nao"
            className="flex cursor-pointer items-center gap-3 rounded-md border bg-white p-3 font-normal hover:bg-slate-50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-slate-50"
          >
            <RadioGroupItem value="nao" id="filiado-nao" />
            Não, ainda não sou filiado
          </Label>
        </RadioGroup>
      </div>

      <div className="flex items-start gap-3 rounded-md border bg-slate-50 p-4">
        <Checkbox id="aceiteLgpd" name="aceiteLgpd" className="mt-1" required />
        <Label
          htmlFor="aceiteLgpd"
          className="text-sm font-normal leading-relaxed text-slate-700"
        >
          Declaro estar ciente e autorizo o tratamento dos meus dados pessoais
          (nome, CPF, telefone, matrícula e e-mail) para a finalidade exclusiva
          de validação e apuração desta eleição sindical, nos termos da{" "}
          <strong>
            Lei Geral de Proteção de Dados Pessoais (LGPD) — Lei nº
            13.709/2018, Art. 7º, inciso I
          </strong>{" "}
          (consentimento do titular).
        </Label>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
