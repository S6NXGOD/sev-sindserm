"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Download,
  FileText,
  Loader2,
  MapPin,
  PartyPopper,
  Search,
  Trophy,
} from "lucide-react";
import type { EleitoRow } from "@/lib/transparencia";
import { fetchEleitosCsv } from "@/lib/actions/transparencia";
import { downloadEleitosPdf } from "@/lib/eleitos-pdf";
import { normalizeForSearch } from "@/lib/slug";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STORAGE_CONFETTI = "sev_mural_confetti";

function usaMenosMovimento() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * MURAL DOS ELEITOS (público) — reconhecimento consolidado de todos os
 * representantes de base eleitos, agrupados por órgão, com busca. Quando o
 * pleito está CONCLUÍDO, vira uma celebração (cabeçalho festivo + confetti uma
 * única vez por navegador, respeitando prefers-reduced-motion). Em andamento,
 * mostra "eleitos até agora". Some quando ainda não há nenhum eleito.
 */
export function MuralEleitos({
  eleitos,
  concluido,
  trienio,
  ano,
  electionId,
  titulo,
  logoSindserm,
  logoPleito,
}: {
  eleitos: EleitoRow[];
  concluido: boolean;
  trienio: string;
  ano: number;
  electionId: string;
  titulo: string;
  logoSindserm: string;
  logoPleito: string | null;
}) {
  const [q, setQ] = useState("");
  const [baixando, setBaixando] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  function agora() {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
  }

  async function baixarPdf() {
    setBaixandoPdf(true);
    try {
      await downloadEleitosPdf(eleitos, {
        logoSindserm,
        logoPleito,
        titulo,
        geradoEm: agora(),
      });
    } finally {
      setBaixandoPdf(false);
    }
  }

  // Confetti uma única vez, só quando concluído (e não repete no mesmo navegador).
  useEffect(() => {
    if (!concluido || eleitos.length === 0) return;
    let jaFez = false;
    try {
      jaFez = localStorage.getItem(`${STORAGE_CONFETTI}_${ano}`) === "1";
    } catch {
      /* ignora */
    }
    if (jaFez || usaMenosMovimento()) return;
    let cancelado = false;
    void (async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({ particleCount: 160, spread: 120, origin: { y: 0.4 } });
        const fim = Date.now() + 2200;
        const frame = () => {
          confetti({
            particleCount: 5,
            startVelocity: 42,
            spread: 75,
            gravity: 1.1,
            origin: { x: Math.random(), y: -0.1 },
          });
          if (!cancelado && Date.now() < fim) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        localStorage.setItem(`${STORAGE_CONFETTI}_${ano}`, "1");
      } catch {
        /* canvas-confetti indisponível — ignora */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [concluido, eleitos.length, ano]);

  const totalLocais = useMemo(
    () => new Set(eleitos.map((e) => e.local)).size,
    [eleitos],
  );
  const totalOrgaos = useMemo(
    () => new Set(eleitos.map((e) => e.orgao)).size,
    [eleitos],
  );

  // Agrupa por órgão (ordenado), filtrando pela busca.
  const grupos = useMemo(() => {
    const termo = normalizeForSearch(q);
    const filtrados = termo
      ? eleitos.filter(
          (e) =>
            normalizeForSearch(e.eleito).includes(termo) ||
            normalizeForSearch(e.local).includes(termo) ||
            normalizeForSearch(e.orgao).includes(termo),
        )
      : eleitos;
    const mapa = new Map<string, EleitoRow[]>();
    for (const e of filtrados) {
      const arr = mapa.get(e.orgao) ?? [];
      arr.push(e);
      mapa.set(e.orgao, arr);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt"))
      .map(([orgao, itens]) => ({
        orgao,
        itens: itens.sort(
          (x, y) =>
            x.local.localeCompare(y.local, "pt") || y.votos - x.votos,
        ),
      }));
  }, [eleitos, q]);

  async function baixarCsv() {
    setBaixando(true);
    try {
      const res = await fetchEleitosCsv(electionId);
      if (!res) return;
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(false);
    }
  }

  if (eleitos.length === 0) return null;
  const totalFiltrado = grupos.reduce((s, g) => s + g.itens.length, 0);

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      {/* Cabeçalho — festivo quando concluído; sóbrio e "ao vivo" em andamento. */}
      <div
        className={
          concluido
            ? "bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white sm:p-6"
            : "border-b bg-slate-50/70 p-4 sm:px-5"
        }
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              concluido ? "bg-white/20" : "bg-primary/10 text-primary"
            }`}
          >
            {concluido ? (
              <PartyPopper className="h-6 w-6" />
            ) : (
              <Trophy className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className={`font-bold tracking-tight ${
                concluido ? "text-lg sm:text-2xl" : "text-sm sm:text-base"
              }`}
            >
              {concluido
                ? "Eleição concluída — conheça seus representantes!"
                : "Representantes de base eleitos"}
            </h2>
            <p
              className={`text-xs ${
                concluido ? "text-emerald-50" : "text-muted-foreground"
              } sm:text-sm`}
            >
              {concluido
                ? `${eleitos.length} representantes eleitos para o triênio ${trienio}. Parabéns aos eleitos e obrigado a quem participou!`
                : `${eleitos.length} eleitos até agora — atualiza conforme os locais encerram.`}
            </p>
          </div>
        </div>

        {/* Números do mural */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { n: eleitos.length, l: "eleitos" },
            { n: totalLocais, l: "locais" },
            { n: totalOrgaos, l: "órgãos" },
          ].map((s) => (
            <span
              key={s.l}
              className={`inline-flex items-baseline gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
                concluido ? "bg-white/15 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
              }`}
            >
              <strong>{s.n}</strong>
              <span className="text-xs font-normal opacity-80">{s.l}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Busca */}
      <div className="border-b p-3 sm:px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, local ou órgão…"
            className="h-10 pl-9"
          />
        </div>
      </div>

      {/* Lista agrupada por órgão (rolável) */}
      <div className="max-h-[30rem] overflow-y-auto">
        {totalFiltrado === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhum eleito encontrado para “{q}”.
          </p>
        ) : (
          grupos.map((g) => (
            <div key={g.orgao}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-slate-50/95 px-4 py-1.5 backdrop-blur sm:px-5">
                <p className="min-w-0 truncate text-xs font-semibold text-slate-600">
                  {g.orgao}
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {g.itens.length}
                </span>
              </div>
              <ul className="divide-y">
                {g.itens.map((e, i) => (
                  <li
                    key={`${e.local}-${e.eleito}-${i}`}
                    className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
                  >
                    <Award className="h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.eleito}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {e.local} · Zona {e.zona}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">
                      {e.votos} {e.votos === 1 ? "voto" : "votos"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Baixar a lista */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50/60 px-4 py-3 sm:px-5">
        <p className="min-w-0 text-xs text-muted-foreground">
          Lista oficial dos eleitos do pleito {ano}.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={baixarPdf}
            disabled={baixandoPdf}
            className="gap-1.5"
          >
            {baixandoPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Baixar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={baixarCsv}
            disabled={baixando}
            className="gap-1.5"
          >
            {baixando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            CSV
          </Button>
        </div>
      </div>
    </section>
  );
}
