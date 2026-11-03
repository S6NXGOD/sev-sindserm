"use client";

import { useMemo, useState } from "react";
import {
  FileDown,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { DiretoriaRow } from "@/lib/relatorio-diretoria";
import {
  downloadDiretoriaPdf,
  type DiretoriaPdfHeader,
} from "@/lib/diretoria-pdf";
import { searchScore, searchTokens } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const ZONA_LABEL: Record<string, string> = {
  NORTE: "Zona Norte",
  SUL: "Zona Sul",
  LESTE: "Zona Leste",
  CENTRO: "Zona Centro",
  SUDESTE: "Zona Sudeste",
  RURAL: "Zona Rural",
};

/** Dígitos p/ wa.me (prefixo 55 Brasil). "" se telefone incompleto. */
function waDigits(tel: string): string {
  const d = tel.replace(/\D/g, "");
  return d.length >= 10 ? `55${d}` : "";
}

function TelefoneCelula({ r }: { r: DiretoriaRow }) {
  if (r.telefone) {
    const wa = waDigits(r.telefone);
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={`tel:${r.telefone.replace(/\D/g, "")}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-primary"
        >
          <Phone className="h-3.5 w-3.5 text-slate-400" />
          {r.telefone}
        </a>
        {r.confianca === "parcial" && (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
            provável
          </span>
        )}
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir no WhatsApp"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }
  if (r.confianca === "ambiguo")
    return (
      <span className="text-xs font-medium text-amber-600">
        vários homônimos — conferir
      </span>
    );
  if (r.confianca === "sem_telefone")
    return <span className="text-xs text-muted-foreground">sem telefone</span>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

function Linha({
  r,
  incluiTelefone,
}: {
  r: DiretoriaRow;
  incluiTelefone: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
        {r.nome.trim().charAt(0).toUpperCase() || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{r.nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {r.local} · {r.orgao}
        </p>
      </div>
      {incluiTelefone && (
        <div className="shrink-0 text-right">
          <TelefoneCelula r={r} />
        </div>
      )}
    </div>
  );
}

type Agrupamento = "zona" | "az";

export function RelatorioDiretoriaView({
  rows,
  incluiTelefone,
  totalZonas,
  comTelefone,
  pdfHeader,
}: {
  rows: DiretoriaRow[];
  incluiTelefone: boolean;
  totalZonas: number;
  comTelefone: number;
  pdfHeader: DiretoriaPdfHeader;
}) {
  const [q, setQ] = useState("");
  const [modo, setModo] = useState<Agrupamento>("zona");
  const [baixando, setBaixando] = useState(false);

  const tokens = searchTokens(q);
  const filtradas = useMemo(
    () =>
      rows.filter(
        (r) =>
          tokens.length === 0 ||
          searchScore(`${r.nome} ${r.local} ${r.orgao} ${r.zona}`, tokens) > 0,
      ),
    [rows, tokens],
  );

  // Agrupa por zona (mantém a ordem já vinda do servidor: zona fixa + nome A–Z).
  const grupos = useMemo(() => {
    const m = new Map<string, DiretoriaRow[]>();
    for (const r of filtradas) {
      const arr = m.get(r.zona) ?? [];
      arr.push(r);
      m.set(r.zona, arr);
    }
    return [...m.entries()];
  }, [filtradas]);

  const az = useMemo(
    () => [...filtradas].sort((a, b) => a.nome.localeCompare(b.nome, "pt")),
    [filtradas],
  );

  async function baixarPdf() {
    setBaixando(true);
    try {
      await downloadDiretoriaPdf(rows, pdfHeader, incluiTelefone);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo + PDF */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            <strong className="text-lg">{rows.length}</strong> eleitos
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-slate-500" />
            <strong className="text-lg">{totalZonas}</strong> zonas
          </span>
          {incluiTelefone && (
            <span className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-sky-600" />
              <strong className="text-lg">{comTelefone}</strong> com telefone
            </span>
          )}
        </div>
        <Button onClick={baixarPdf} disabled={baixando} className="shrink-0">
          {baixando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          Baixar PDF
        </Button>
      </div>

      {/* Busca + alternância */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar representante, lotação, órgão ou zona..."
            className="h-11 pl-9"
          />
        </div>
        <div className="flex shrink-0 rounded-lg border bg-white p-0.5">
          {(
            [
              { id: "zona", label: "Por zona" },
              { id: "az", label: "A–Z" },
            ] as { id: Agrupamento; label: string }[]
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setModo(o.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition",
                modo === o.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {incluiTelefone && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
          📞 Telefone cruzado automaticamente do <strong>votante homônimo do
          mesmo local</strong> (tolera abreviações, ex.: “Francisco S. Soares”).
          “Provável” e “conferir” pedem conferência. Uso interno — não aparece no
          portal público (LGPD).
        </p>
      )}

      {filtradas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "Nenhum representante eleito ainda."
            : "Nenhum resultado para a busca."}
        </p>
      ) : modo === "zona" ? (
        <div className="space-y-4">
          {grupos.map(([zona, itens]) => (
            <Card key={zona} className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2.5">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {ZONA_LABEL[zona] ?? zona}
                </p>
                <span className="text-xs text-muted-foreground">
                  {itens.length} representante(s)
                </span>
              </div>
              <div className="divide-y">
                {itens.map((r, i) => (
                  <Linha key={`${r.nome}-${i}`} r={r} incluiTelefone={incluiTelefone} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y">
            {az.map((r, i) => (
              <Linha key={`${r.nome}-${i}`} r={r} incluiTelefone={incluiTelefone} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
