"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Bump a versão para reexibir o tour a todos (ex.: mudou bastante o portal).
const STORAGE_KEY = "sev_tour_portal_v1";

type Passo = {
  /** Seletor do elemento real a destacar. Vazio = passo de boas-vindas (centro). */
  sel?: string;
  titulo: string;
  texto: string;
};

// Ordem pedagógica: visão geral → regras → baixar → conferir → achar → resultado.
const PASSOS: Passo[] = [
  {
    titulo: "Bem-vindo à Transparência 👋",
    texto:
      "Vou te mostrar, em poucos passos, como acompanhar a eleição, ver os eleitos, baixar documentos e conferir que está tudo limpo. Leva 30 segundos.",
  },
  {
    sel: '[data-tour="kpis"]',
    titulo: "A visão geral do pleito",
    texto:
      "Aqui ficam os números do momento: total de votantes, eleitos já definidos, locais em andamento e encerrados. Atualiza sozinho conforme os votos entram.",
  },
  {
    sel: '[data-tour="regimento"]',
    titulo: "As regras oficiais",
    texto:
      "Toque aqui para baixar o Regimento da Eleição — quem pode votar e concorrer, como se apura e o calendário. É o documento da Diretoria Colegiada.",
  },
  {
    sel: '[data-tour="relatorio"]',
    titulo: "Baixe os relatórios",
    texto:
      "Neste botão você gera o relatório completo do pleito em PDF (ou a planilha dos eleitos). Aqui também troca o pleito, se houver mais de um.",
  },
  {
    sel: '[data-tour="auditoria"]',
    titulo: "Confira que é limpo",
    texto:
      "Toque para abrir a auditoria: você vê que o total de votos bate com o de votantes (urna conferida), as garantias do sistema e como contestar se algo parecer errado.",
  },
  {
    sel: '[data-tour="busca"]',
    titulo: "Ache o seu local",
    texto:
      "Digite o nome do seu local ou órgão, ou filtre por situação (em andamento, encerrada, agendada). É o caminho mais rápido para a sua urna.",
  },
  {
    sel: '[data-tour="locais"]',
    titulo: "Veja o resultado do local",
    texto:
      "Em cada card, “Ver eleitos e suplentes” abre o resultado e a linha do tempo; o botão “PDF” baixa o resultado daquele local. É aqui que a maioria vai direto.",
  },
];

function usaMenosMovimento() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Tour do portal com HOLOFOTE: destaca cada elemento real da página e ensina
 * onde clicar. Abre sozinho na 1ª visita (uma vez) e fica sempre no botão
 * "Como usar". Sem biblioteca externa; mobile-first; respeita reduced-motion.
 * Passos cujo alvo não existe na tela são pulados automaticamente.
 */
export function GuiaPortal() {
  const [ativo, setAtivo] = useState(false);
  const [passos, setPassos] = useState<Passo[]>([]);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const iniciar = useCallback(() => {
    // Monta a lista só com passos cujo alvo está visível agora.
    const visiveis = PASSOS.filter((p) => {
      if (!p.sel) return true;
      const el = document.querySelector(p.sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    setPassos(visiveis);
    setIdx(0);
    setAtivo(true);
  }, []);

  const fechar = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignora */
    }
    setAtivo(false);
    setRect(null);
  }, []);

  // Primeira visita: abre o tour uma única vez, após o layout assentar.
  useEffect(() => {
    let quer = false;
    try {
      quer = !localStorage.getItem(STORAGE_KEY);
    } catch {
      quer = false;
    }
    if (!quer) return;
    const t = setTimeout(() => iniciar(), 700);
    return () => clearTimeout(t);
  }, [iniciar]);

  const passo = passos[idx];

  // Mede o alvo (e mantém alinhado ao rolar/redimensionar). Rola até o centro.
  useEffect(() => {
    if (!ativo || !passo) return;
    if (!passo.sel) {
      setRect(null);
      return;
    }
    const el = document.querySelector(passo.sel) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({
      behavior: usaMenosMovimento() ? "auto" : "smooth",
      block: "center",
    });
    const medir = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(medir, usaMenosMovimento() ? 0 : 340);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [ativo, idx, passo]);

  // Teclado: setas navegam, Esc fecha.
  useEffect(() => {
    if (!ativo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      else if (e.key === "ArrowRight") setIdx((n) => Math.min(n + 1, passos.length - 1));
      else if (e.key === "ArrowLeft") setIdx((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ativo, passos.length, fechar]);

  const ultimo = idx === passos.length - 1;
  const primeiro = idx === 0;

  // Posição do balão: acima ou abaixo do alvo (o que couber); centro no boas-vindas.
  const LARG = 340;
  const GAP = 14;
  let balao: React.CSSProperties;
  if (!rect) {
    balao = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: `min(${LARG}px, calc(100vw - 32px))`,
    };
  } else {
    const vw = typeof window !== "undefined" ? window.innerWidth : 400;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const w = Math.min(LARG, vw - 32);
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 16));
    const acima = rect.top > vh * 0.55;
    balao = acima
      ? { left, bottom: vh - rect.top + GAP, width: w }
      : { left, top: rect.bottom + GAP, width: w };
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={iniciar}
        className="gap-1.5"
      >
        <HelpCircle className="h-4 w-4" />
        Como usar
      </Button>

      {ativo && passo && (
        <div
          className="fixed inset-0 z-[80]"
          role="dialog"
          aria-modal="true"
          onClick={() => (ultimo ? fechar() : setIdx((n) => n + 1))}
        >
          {/* Holofote: recorta o alvo e escurece o resto (ou dim total no intro). */}
          {rect ? (
            <div
              aria-hidden
              className="pointer-events-none fixed rounded-xl ring-2 ring-white/90 transition-all duration-300"
              style={{
                left: rect.left - 6,
                top: rect.top - 6,
                width: rect.width + 12,
                height: rect.height + 12,
                boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.66)",
              }}
            />
          ) : (
            <div aria-hidden className="fixed inset-0 bg-slate-900/70" />
          )}

          {/* Balão explicativo (não fecha ao tocar nele). */}
          <div
            className="fixed rounded-2xl border bg-white p-4 shadow-xl"
            style={balao}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              {primeiro && <Sparkles className="h-4 w-4 text-primary" />}
              <p className="text-sm font-bold">{passo.titulo}</p>
              <span className="ml-auto text-[11px] font-medium text-muted-foreground">
                {idx + 1}/{passos.length}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {passo.texto}
            </p>

            {/* Progresso */}
            <div className="mt-3 flex items-center gap-1.5">
              {passos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Passo ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? "w-5 bg-primary" : "w-1.5 bg-slate-300"
                  }`}
                />
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              {primeiro ? (
                <Button type="button" variant="ghost" size="sm" onClick={fechar}>
                  Pular
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIdx((n) => n - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>
              )}
              {ultimo ? (
                <Button type="button" size="sm" onClick={fechar}>
                  Entendi, explorar
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIdx((n) => n + 1)}
                  className="gap-1"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
