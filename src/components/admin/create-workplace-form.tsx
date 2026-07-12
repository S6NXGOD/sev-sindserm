"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  CalendarClock,
  ChevronDown,
  FileUp,
  Loader2,
  Plus,
  Trash2,
  Users,
  Vote,
  X,
} from "lucide-react";
import { createWorkplace } from "@/lib/actions/admin";
import { initialActionState } from "@/lib/types";
import { ORGAOS, ZONAS } from "@/lib/constants";
import { slugify } from "@/lib/slug";
import { parseNomesCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Quantos chips renderizar (listas grandes vêm de CSV; o restante fica só no
// estado/contagem para não pesar o DOM).
const CHIPS_VISIVEIS = 150;
const ORGAO_OPTIONS = ORGAOS.map((o) => ({ value: o, label: o }));

function SubmitButton({ qtdCandidatos }: { qtdCandidatos: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      {qtdCandidatos > 0
        ? `Cadastrar local + ${qtdCandidatos} candidato(s)`
        : "Cadastrar local"}
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

  // ----- Candidatos (OPCIONAL) -----
  const [openCand, setOpenCand] = useState(false);
  const [candidatos, setCandidatos] = useState<string[]>([]);
  const [candInput, setCandInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

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

  function addCandidatoManual() {
    const novo = candInput.trim().slice(0, 120);
    if (!novo) return;
    // Permite homônimos: dois candidatos com o mesmo nome são distintos.
    setCandidatos((prev) => [...prev, novo]);
    setCandInput("");
  }

  function removeCandidato(index: number) {
    setCandidatos((prev) => prev.filter((_, i) => i !== index));
  }

  async function processarCsv(file: File) {
    try {
      const txt = await file.text();
      const nomes = parseNomesCsv(txt);
      if (nomes.length === 0) {
        toast.error('Nenhum nome detectado. Verifique a coluna "nome".');
        return;
      }
      // Acrescenta TODOS os nomes (sem deduplicar — homônimos são válidos).
      setCandidatos((prev) => [...prev, ...nomes]);
      toast.success(`${nomes.length} nome(s) adicionados do CSV.`);
      setOpenCand(true);
    } catch {
      toast.error("Não foi possível ler o arquivo CSV.");
    } finally {
      if (csvRef.current) csvRef.current.value = "";
    }
  }

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
      {/* Candidatos opcionais viajam junto no POST (lista de nomes em JSON). */}
      <input type="hidden" name="candidatos" value={JSON.stringify(candidatos)} />

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
          <Combobox
            id="orgao"
            value={orgao}
            onChange={setOrgao}
            options={ORGAO_OPTIONS}
            placeholder="Selecione o órgão"
            searchPlaceholder="Buscar órgão..."
          />
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

      {/* NOVA REGRA: o local não herda as datas do pleito. Nasce SEM janela
          ("Aguardando Agendamento") e a diretoria agenda ao visitar o local. */}
      <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">A votação nasce sem data — e isso é o esperado.</p>
          <p className="mt-0.5 text-amber-700">
            O local será criado com o status{" "}
            <strong>Aguardando Agendamento</strong>. A urna só abre quando a
            diretoria visitar o local e definir início e fim na página dele.
          </p>
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

      {/* ----- Seção OPCIONAL de candidatos (accordion) ----- */}
      <div className="rounded-md border">
        <button
          type="button"
          onClick={() => setOpenCand((o) => !o)}
          aria-expanded={openCand}
          className="flex w-full items-center justify-between gap-2 p-4 text-left"
        >
          <span className="flex flex-wrap items-center gap-2 font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
            Candidatos{" "}
            <span className="font-normal text-muted-foreground">(Opcional)</span>
            {candidatos.length > 0 && (
              <Badge variant="secondary">{candidatos.length}</Badge>
            )}
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              openCand && "rotate-180",
            )}
          />
        </button>

        {openCand && (
          <div className="space-y-4 border-t p-4">
            <p className="text-sm text-muted-foreground">
              Adicione os candidatos agora (manual ou CSV) ou deixe em branco e
              cadastre depois — é totalmente opcional. O local é salvo mesmo sem
              candidatos.
            </p>

            {/* Inserção manual — empilha no mobile, lado a lado no desktop. */}
            <div className="space-y-2">
              <Label htmlFor="cand-nome">Adicionar manualmente</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="cand-nome"
                  value={candInput}
                  onChange={(e) => setCandInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault(); // não envia o formulário inteiro
                      addCandidatoManual();
                    }
                  }}
                  placeholder="Nome do candidato"
                  className="sm:flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addCandidatoManual}
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>

            {/* Importação por CSV — dropzone (toque no mobile, arrasto no PC). */}
            <div className="space-y-2">
              <Label htmlFor="cand-csv">Importar via CSV</Label>
              <label
                htmlFor="cand-csv"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void processarCsv(f);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition",
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "bg-slate-50 hover:bg-slate-100",
                )}
              >
                <FileUp className="h-6 w-6" />
                <span>
                  <strong className="text-foreground">Toque para enviar</strong>{" "}
                  ou arraste o arquivo <code>.csv</code> aqui
                </span>
                <span className="text-xs">
                  Coluna única com cabeçalho <code>nome</code>
                </span>
              </label>
              <input
                ref={csvRef}
                id="cand-csv"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void processarCsv(f);
                }}
              />
            </div>

            {/* Lista de candidatos adicionados (cards/chips empilháveis). */}
            {candidatos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {candidatos.length} candidato(s) na lista
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCandidatos([])}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Limpar
                  </Button>
                </div>
                <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto rounded-md border bg-slate-50 p-2">
                  {candidatos.slice(0, CHIPS_VISIVEIS).map((c, i) => (
                    <span
                      key={`${i}-${c}`}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border bg-white py-1 pl-3 pr-1 text-sm"
                    >
                      <span className="max-w-[200px] truncate">{c}</span>
                      <button
                        type="button"
                        onClick={() => removeCandidato(i)}
                        aria-label={`Remover ${c}`}
                        className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  {candidatos.length > CHIPS_VISIVEIS && (
                    <span className="self-center px-2 text-xs text-muted-foreground">
                      +{candidatos.length - CHIPS_VISIVEIS} outros (serão salvos)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <SubmitButton qtdCandidatos={candidatos.length} />
    </form>
  );
}
