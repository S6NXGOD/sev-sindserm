"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Loader2, Upload } from "lucide-react";
import { importCandidatesChunk } from "@/lib/actions/admin";
import { parseNomesCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
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

// Lote enviado por requisição. Pequeno o suficiente para não pesar e dar
// progresso suave; grande o suficiente para poucas requisições.
const CHUNK_SIZE = 500;

export function ImportCandidates({
  workplaceId,
  workplaceNome,
}: {
  workplaceId: string;
  workplaceNome: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [nomes, setNomes] = useState<string[]>([]);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const total = nomes.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function resetLocal() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileName("");
    setNomes([]);
    setParsed(false);
    setDone(0);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      resetLocal();
      return;
    }
    setFileName(f.name);
    setDone(0);
    try {
      const txt = await f.text();
      setNomes(parseNomesCsv(txt));
    } catch {
      setNomes([]);
    } finally {
      setParsed(true);
    }
  }

  async function handleImport() {
    if (nomes.length === 0) return;
    setImporting(true);
    setDone(0);
    let inseridos = 0;

    try {
      for (let i = 0; i < nomes.length; i += CHUNK_SIZE) {
        const lote = nomes.slice(i, i + CHUNK_SIZE);
        const isLast = i + CHUNK_SIZE >= nomes.length;
        const res = await importCandidatesChunk(workplaceId, lote, isLast);

        if (res.status === "error") {
          toast.error(res.message ?? "Erro ao importar.");
          router.refresh(); // mostra o que já foi inserido
          return;
        }

        inseridos += res.count;
        setDone(Math.min(i + CHUNK_SIZE, nomes.length));
      }

      toast.success(
        `${inseridos} candidatos importados com sucesso para o local ${workplaceNome}`,
      );
      setOpen(false);
      resetLocal();
      router.refresh();
    } catch {
      toast.error("Erro inesperado durante a importação.");
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (importing) return; // não fecha durante a importação
        setOpen(o);
        if (!o) resetLocal();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileUp className="mr-2 h-4 w-4" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar candidatos por CSV</DialogTitle>
          <DialogDescription>
            Local: <strong>{workplaceNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">
              Formato esperado
            </Label>
            <p className="text-xs text-muted-foreground">
              Um arquivo <code>.csv</code> com uma única coluna e cabeçalho{" "}
              <code>nome</code>:
            </p>
            <pre className="rounded-md border bg-slate-50 p-3 text-xs leading-relaxed">
              {"nome\nJoão da Silva\nMaria Souza"}
            </pre>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Arquivo .csv</Label>
            <input
              ref={fileInputRef}
              id="file"
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={onFileChange}
              className="block w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">{fileName}</span>
                {parsed && <> — {total} nome(s) detectado(s)</>}
              </p>
            )}
            {parsed && total === 0 && (
              <p className="text-xs text-destructive">
                Nenhum nome detectado. Verifique se há uma coluna “nome”.
              </p>
            )}
          </div>

          {/* Barra de progresso */}
          {importing && (
            <div className="space-y-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Importando… {done} de {total} ({pct}%)
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={importing}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={importing || total === 0}
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {importing ? "Importando…" : "Importar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
