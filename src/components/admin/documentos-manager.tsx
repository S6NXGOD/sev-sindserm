"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Trash2, ExternalLink } from "lucide-react";
import { publicarDocumento, excluirDocumento } from "@/lib/actions/documentos";
import { initialActionState } from "@/lib/types";
import {
  CATEGORIAS_DOCUMENTO,
  MAX_DOC_BYTES,
  formatarTamanho,
  type DocumentoView,
} from "@/lib/documentos-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MB = Math.floor(MAX_DOC_BYTES / 1_000_000);

function PublishButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Upload className="mr-2 h-4 w-4" />
      )}
      Publicar documento
    </Button>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-red-600 hover:bg-red-50 hover:text-red-700"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      <span className="sr-only">Excluir documento</span>
    </Button>
  );
}

/** Botão de exclusão de UM documento (cada linha tem seu próprio estado). */
function DeleteDocForm({ id, titulo }: { id: string; titulo: string }) {
  const router = useRouter();
  const [state, formAction] = useFormState(excluirDocumento, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.refresh();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Excluir o documento "${titulo}"? Esta ação não pode ser desfeita.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <DeleteSubmit />
    </form>
  );
}

/**
 * Gerência de documentos oficiais de UM pleito (atas/editais/resultados).
 * Publica PDFs (validados no servidor) e lista os já publicados com opção de
 * excluir. Usada na tela de edição do pleito. A lista pública fica no portal.
 */
export function DocumentosManager({
  electionId,
  documentos,
}: {
  electionId: string;
  documentos: DocumentoView[];
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(
    publicarDocumento,
    initialActionState,
  );
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_DOCUMENTO[0]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
      setCategoria(CATEGORIAS_DOCUMENTO[0]);
      router.refresh();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <div className="space-y-5">
      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 rounded-lg border p-4"
        encType="multipart/form-data"
      >
        <input type="hidden" name="electionId" value={electionId} />
        {/* Select do Radix não é input nativo → espelha no hidden input. */}
        <input type="hidden" name="categoria" value={categoria} />

        <div className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-2 sm:col-span-4">
            <Label htmlFor="doc-titulo">Título do documento *</Label>
            <Input
              id="doc-titulo"
              name="titulo"
              maxLength={160}
              placeholder="Ex.: Ata da apuração — IPMT"
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="doc-categoria">Categoria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="doc-categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_DOCUMENTO.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="doc-arquivo">Arquivo PDF *</Label>
          <input
            id="doc-arquivo"
            name="arquivo"
            type="file"
            accept="application/pdf,.pdf"
            required
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && f.size > MAX_DOC_BYTES) {
                toast.error(`Arquivo muito grande (máx. ${MB} MB).`);
                e.target.value = "";
              }
            }}
            className="block w-full cursor-pointer rounded-md border border-input bg-background text-sm text-slate-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <p className="text-xs text-muted-foreground">
            Somente PDF, até {MB} MB. Fica público no Portal da Transparência
            (aba “Regras &amp; Auditoria”).
          </p>
        </div>

        <PublishButton />
      </form>

      {documentos.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhum documento publicado ainda.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-3">
              <FileText className="h-5 w-5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.titulo}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge variant="secondary">{d.categoria}</Badge>
                  <span>{formatarTamanho(d.tamanho)}</span>
                  <span>·</span>
                  <span>{new Date(d.createdAt).toLocaleDateString("pt-BR")}</span>
                  <span>·</span>
                  <span className="truncate">{d.publicadoPorNome}</span>
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <a href={d.arquivoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  Abrir
                </a>
              </Button>
              <DeleteDocForm id={d.id} titulo={d.titulo} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
