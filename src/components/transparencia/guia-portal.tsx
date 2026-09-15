"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Award,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  HelpCircle,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Bump a versão para reexibir o guia a todos (ex.: mudou bastante o portal).
const STORAGE_KEY = "sev_guia_portal_v1";

type Passo = {
  Icon: React.ComponentType<{ className?: string }>;
  cor: string;
  titulo: string;
  texto: string;
};

const PASSOS: Passo[] = [
  {
    Icon: Sparkles,
    cor: "bg-primary/10 text-primary",
    titulo: "Bem-vindo à Transparência",
    texto:
      "Aqui você acompanha a eleição dos Representantes de Base em tempo real — sem login e sem cadastro. Tudo é público e pode ser conferido por qualquer filiado.",
  },
  {
    Icon: Activity,
    cor: "bg-emerald-50 text-emerald-600",
    titulo: "Acompanhe ao vivo",
    texto:
      "Os números no topo e o painel de participação mostram quantos já votaram em cada local e zona. Quando a diretoria habilita, você vê também quem está liderando — a página se atualiza sozinha.",
  },
  {
    Icon: Award,
    cor: "bg-emerald-50 text-emerald-600",
    titulo: "Veja eleitos e suplentes",
    texto:
      "Procure o seu local na busca lá embaixo e toque em “Ver eleitos e suplentes”. Quando a votação encerra, aparecem os eleitos, os suplentes e quem não assumiu (com o motivo).",
  },
  {
    Icon: Clock,
    cor: "bg-slate-100 text-slate-600",
    titulo: "Histórico de cada local",
    texto:
      "Dentro do card do local, abra “Linha do tempo e histórico” para ver cada passo oficial (agendamento, encerramento, suplementar) e o resultado de cada rodada — inclusive baixar o PDF de rodadas anteriores.",
  },
  {
    Icon: Download,
    cor: "bg-sky-50 text-sky-600",
    titulo: "Baixe os relatórios",
    texto:
      "No botão “Baixar relatório” você gera um PDF completo do pleito (ou uma planilha dos eleitos). No card de cada local, o botão “PDF” baixa o resultado daquele local. E no topo você baixa o Regimento da Eleição.",
  },
  {
    Icon: ShieldCheck,
    cor: "bg-emerald-50 text-emerald-600",
    titulo: "Confira que é limpo",
    texto:
      "No bloco “Auditoria, integridade e lisura” você confere que o total de votos bate com o de votantes (urna conferida), entende as garantias do sistema e o que é público × protegido (LGPD).",
  },
  {
    Icon: Mail,
    cor: "bg-amber-50 text-amber-600",
    titulo: "Achou algo estranho? Conteste",
    texto:
      "Qualquer filiado pode contestar. Reúna o nome do local, o protocolo do seu comprovante e o motivo, e use o botão de contestação (abre o e-mail oficial). A diretoria responde pelo canal oficial.",
  },
];

/**
 * Guia do Portal da Transparência: um passo a passo simples e humano, que abre
 * SOZINHO na primeira visita (uma vez) e fica sempre acessível pelo botão
 * "Como usar". Ensina a acompanhar, ver eleitos, baixar, auditar e contestar.
 */
export function GuiaPortal() {
  const [open, setOpen] = useState(false);
  const [passo, setPasso] = useState(0);

  // Primeira visita: abre o guia uma única vez (localStorage, à prova de erro).
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      /* modo privado / storage bloqueado: simplesmente não auto-abre */
    }
  }, []);

  function marcarVisto() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignora */
    }
  }

  function fechar() {
    marcarVisto();
    setOpen(false);
    setPasso(0);
  }

  function abrir() {
    setPasso(0);
    setOpen(true);
  }

  const p = PASSOS[passo];
  const ultimo = passo === PASSOS.length - 1;
  const primeiro = passo === 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={abrir}
        className="gap-1.5"
      >
        <HelpCircle className="h-4 w-4" />
        Como usar
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) fechar();
          else setOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`rounded-lg p-2 ${p.cor}`}>
                <p.Icon className="h-5 w-5" />
              </span>
              {p.titulo}
            </DialogTitle>
          </DialogHeader>

          <p className="min-h-[84px] text-sm leading-relaxed text-muted-foreground">
            {p.texto}
          </p>

          {/* Progresso (bolinhas) — toque para pular direto a um passo. */}
          <div className="flex items-center justify-center gap-1.5">
            {PASSOS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Passo ${i + 1}`}
                onClick={() => setPasso(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === passo ? "w-5 bg-primary" : "w-1.5 bg-slate-300"
                }`}
              />
            ))}
          </div>

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            {primeiro ? (
              <Button type="button" variant="ghost" size="sm" onClick={fechar}>
                Pular
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPasso((n) => n - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
            )}
            {ultimo ? (
              <Button type="button" size="sm" onClick={fechar}>
                Começar a explorar
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setPasso((n) => n + 1)}
                className="gap-1"
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
