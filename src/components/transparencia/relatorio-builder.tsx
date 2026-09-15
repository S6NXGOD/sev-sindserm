"use client";

import { useState } from "react";
import { FileText, Loader2, Sliders } from "lucide-react";
import { toast } from "sonner";
import { fetchRelatorioTransparencia } from "@/lib/actions/transparencia";
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
  { chave: "metodologia", label: "Metodologia e LGPD", desc: "Como a apuração funciona e o que é público." },
];

/**
 * "Monte seu relatório": o filiado escolhe as seções e gera um PDF só com o que
 * quer saber. Gera no cliente (jsPDF) a partir de dados PÚBLICOS (sem PII).
 */
export function RelatorioBuilder({ electionId }: { electionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [secoes, setSecoes] = useState<SecoesRelatorio>({
    resumo: true,
    integridade: true,
    zona: true,
    orgao: false,
    eleitos: true,
    metodologia: true,
  });

  const algumaMarcada = Object.values(secoes).some(Boolean);

  function toggle(chave: Chave) {
    setSecoes((s) => ({ ...s, [chave]: !s[chave] }));
  }

  async function gerar() {
    if (!algumaMarcada) {
      toast.info("Escolha pelo menos uma seção.");
      return;
    }
    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Sliders className="mr-2 h-4 w-4" />
          Personalizado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Monte seu relatório
          </DialogTitle>
          <DialogDescription>
            Escolha o que você quer no PDF. Só entram dados públicos e auditáveis
            — nenhum dado pessoal de votante.
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={gerar} disabled={loading || !algumaMarcada}>
            {loading ? (
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
