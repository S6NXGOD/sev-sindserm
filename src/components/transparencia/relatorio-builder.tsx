"use client";

import { useState } from "react";
import { CheckCheck, Download, FileSpreadsheet, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  fetchEleitosCsv,
  fetchRelatorioTransparencia,
} from "@/lib/actions/transparencia";
import {
  downloadRelatorioPersonalizado,
  type SecoesRelatorio,
} from "@/lib/transparencia-pdf";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Chave = keyof SecoesRelatorio;

const SECOES: { chave: Chave; label: string; desc: string }[] = [
  { chave: "resumo", label: "Resumo do pleito", desc: "Locais, votantes, vagas, eleitos e status." },
  { chave: "integridade", label: "Integridade (reconciliação)", desc: "Votantes x votos — a prova de que os números batem." },
  { chave: "zona", label: "Participação por zona", desc: "Comparecimento por zona da cidade." },
  { chave: "orgao", label: "Participação por órgão", desc: "Comparecimento por órgão/secretaria." },
  { chave: "eleitos", label: "Eleitos por local", desc: "Todos os eleitos dos locais encerrados." },
  { chave: "metodologia", label: "Metodologia, LGPD e como contestar", desc: "Como a apuração funciona, o que é público e como contestar." },
];

// Preset "Completo": tudo marcado — o padrão ao abrir (uma decisão a menos).
const COMPLETO: SecoesRelatorio = {
  resumo: true,
  integridade: true,
  zona: true,
  orgao: true,
  eleitos: true,
  metodologia: true,
};

/**
 * "Baixar relatório" — PONTO ÚNICO de exportação do portal. Abre já no preset
 * COMPLETO (tudo marcado); o filiado pode desmarcar o que não quer. Gera o PDF
 * no cliente (jsPDF) a partir de dados PÚBLICOS (sem PII), ou baixa a planilha
 * CSV de eleitos. Substitui os antigos botões separados (Geral + Personalizado).
 */
export function RelatorioBuilder({ electionId }: { electionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"pdf" | "csv" | null>(null);
  const [secoes, setSecoes] = useState<SecoesRelatorio>(COMPLETO);

  const marcadas = Object.values(secoes).filter(Boolean).length;
  const algumaMarcada = marcadas > 0;
  const todasMarcadas = marcadas === SECOES.length;

  function toggle(chave: Chave) {
    setSecoes((s) => ({ ...s, [chave]: !s[chave] }));
  }
  function marcarTodas() {
    setSecoes(COMPLETO);
  }
  function limpar() {
    setSecoes({
      resumo: false,
      integridade: false,
      zona: false,
      orgao: false,
      eleitos: false,
      metodologia: false,
    });
  }

  async function gerarPdf() {
    if (!algumaMarcada) {
      toast.info("Escolha pelo menos uma seção.");
      return;
    }
    setLoading("pdf");
    try {
      const data = await fetchRelatorioTransparencia(electionId);
      if (!data) {
        toast.error("Não foi possível carregar os dados do relatório.");
        return;
      }
      await downloadRelatorioPersonalizado(data, secoes);
      setOpen(false);
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    } finally {
      setLoading(null);
    }
  }

  async function baixarCsv() {
    setLoading("csv");
    try {
      const res = await fetchEleitosCsv(electionId);
      if (!res || res.csv.trim().split("\n").length <= 1) {
        toast.info("Ainda não há eleitos consolidados neste pleito.");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível gerar o CSV.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 w-full shrink-0 whitespace-nowrap sm:h-12 sm:w-auto sm:px-5">
          <Download className="mr-2 h-4 w-4" />
          Baixar relatório
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Baixar relatório
          </DialogTitle>
          <DialogDescription>
            Já vem completo — desmarque o que não quiser. Só entram dados públicos
            e auditáveis, nenhum dado pessoal de votante.
          </DialogDescription>
        </DialogHeader>

        {/* Presets rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={marcarTodas}
            disabled={todasMarcadas}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition enabled:hover:bg-slate-50 disabled:border-primary disabled:bg-primary/10 disabled:text-primary"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Completo
          </button>
          <button
            type="button"
            onClick={limpar}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </button>
          <span className="ml-auto text-xs text-muted-foreground">
            {marcadas}/{SECOES.length} seções
          </span>
        </div>

        <div className="space-y-2">
          {SECOES.map((s) => (
            <label
              key={s.chave}
              htmlFor={`sec-${s.chave}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition hover:bg-slate-50"
            >
              <Checkbox
                id={`sec-${s.chave}`}
                checked={secoes[s.chave]}
                onCheckedChange={() => toggle(s.chave)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {/* CSV: opção secundária (planilha só com os eleitos, p/ Excel). */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={baixarCsv}
            disabled={loading !== null}
          >
            {loading === "csv" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Planilha CSV (eleitos)
          </Button>
          <Button
            type="button"
            onClick={gerarPdf}
            disabled={loading !== null || !algumaMarcada}
          >
            {loading === "pdf" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
