"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { exportLocaisReport, getLocaisReportData } from "@/lib/actions/admin";
import { downloadLocaisReportPdf } from "@/lib/locais-report-pdf";
import { ORGAOS, ZONAS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { WorkplaceCombobox } from "@/components/admin/workplace-combobox";
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

const ALL = "all";
const ORGAO_OPTIONS = ORGAOS.map((o) => ({ value: o, label: o }));

/**
 * Gerador de RELATÓRIO DINÂMICO de locais (CSV), Mobile-First. Filtros cruzados
 * (local específico / zona / órgão / status) + caixas para anexar votantes
 * (todos ou só filiados) e/ou candidatos de cada local, unificados no arquivo.
 */
export function ReportGenerator({ ano }: { ano: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [zona, setZona] = useState(ALL);
  const [orgao, setOrgao] = useState("");
  const [status, setStatus] = useState(ALL);
  const [localId, setLocalId] = useState("");
  const [localLabel, setLocalLabel] = useState("");
  const [incluirFiliados, setIncluirFiliados] = useState(true);
  const [somenteFiliados, setSomenteFiliados] = useState(false);
  const [incluirCandidatos, setIncluirCandidatos] = useState(false);

  function buildOpts() {
    return {
      anoEleicao: ano,
      zona: zona === ALL ? undefined : zona,
      orgao: orgao || undefined,
      status: status === ALL ? undefined : status,
      localId: localId || undefined,
      incluirFiliados,
      somenteFiliados,
      incluirCandidatos,
    };
  }

  async function gerarCsv() {
    setLoading(true);
    try {
      const csv = await exportLocaisReport(buildOpts());
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-locais-${ano}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV gerado com os filtros escolhidos.");
      setOpen(false);
    } catch {
      toast.error("Não foi possível gerar o CSV.");
    } finally {
      setLoading(false);
    }
  }

  async function gerarPdf() {
    setPdfLoading(true);
    try {
      const dados = await getLocaisReportData(buildOpts());
      await downloadLocaisReportPdf(dados);
      toast.success("PDF gerado com os filtros escolhidos.");
      setOpen(false);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Gerar relatório
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar relatório de locais (CSV)</DialogTitle>
          <DialogDescription>
            Filtros cruzados + anexar votantes/filiados e/ou candidatos de cada
            local. Deixe em branco para incluir todos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Local específico (opcional)</Label>
            <WorkplaceCombobox
              ano={ano}
              value={localId}
              valueLabel={localLabel}
              placeholder="Todos os locais dos filtros"
              clearLabel="Todos os locais dos filtros"
              onSelect={(id, label) => {
                setLocalId(id);
                setLocalLabel(label);
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Zona</Label>
              <Select value={zona} onValueChange={setZona}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {ZONAS.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Órgão</Label>
              <Combobox
                value={orgao}
                onChange={setOrgao}
                options={ORGAO_OPTIONS}
                placeholder="Todos os órgãos"
                searchPlaceholder="Buscar órgão..."
                clearLabel="Todos os órgãos"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                <SelectItem value="open">Em andamento</SelectItem>
                <SelectItem value="closed">Encerradas</SelectItem>
                <SelectItem value="upcoming">Não iniciadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-xs uppercase text-muted-foreground">
              Anexar ao relatório
            </Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={incluirFiliados}
                onCheckedChange={(c) => setIncluirFiliados(Boolean(c))}
              />
              Incluir votantes do local
            </label>
            {incluirFiliados && (
              <label className="ml-6 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={somenteFiliados}
                  onCheckedChange={(c) => setSomenteFiliados(Boolean(c))}
                />
                Somente filiados
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={incluirCandidatos}
                onCheckedChange={(c) => setIncluirCandidatos(Boolean(c))}
              />
              Incluir lista de candidatos do local
            </label>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="w-full sm:mr-auto sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={gerarCsv}
            disabled={loading || pdfLoading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            CSV
          </Button>
          <Button
            type="button"
            onClick={gerarPdf}
            disabled={loading || pdfLoading}
            className="w-full sm:w-auto"
          >
            {pdfLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
