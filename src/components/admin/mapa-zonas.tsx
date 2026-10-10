import { Crown, MapPin, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { ZonaRep } from "@/lib/mandato";

// Layout esquemático em compasso (3x3). Não é um mapa geográfico real de
// Teresina (sem GeoJSON) — é uma leitura rápida por orientação (N/S/L/O).
const LAYOUT: (string | null)[] = [
  null, "NORTE", null,
  "RURAL", "CENTRO", "LESTE",
  null, "SUL", "SUDESTE",
];

const ZONA_LABEL: Record<string, string> = {
  NORTE: "Norte",
  SUL: "Sul",
  LESTE: "Leste",
  CENTRO: "Centro",
  SUDESTE: "Sudeste",
  RURAL: "Rural",
};

/** Intensidade (choropleth) por densidade — classes FIXAS (Tailwind as inclui). */
function tileColor(ratio: number) {
  if (ratio <= 0) return "bg-slate-50 text-slate-400 ring-1 ring-slate-200";
  if (ratio < 0.25)
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (ratio < 0.5)
    return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300";
  if (ratio < 0.75)
    return "bg-emerald-200 text-emerald-900 ring-1 ring-emerald-400";
  return "bg-emerald-500 text-white ring-1 ring-emerald-600 shadow-sm";
}

/**
 * MAPA DE REPRESENTANTES POR ZONA — tabuleiro gamificado na dashboard. Mostra a
 * concentração de representantes por zona da cidade (quanto mais escuro, mais
 * representantes), destaca a zona líder (coroa) e a cobertura (zonas com ≥1).
 */
export function MapaZonas({
  zonas,
  total,
  fonte,
}: {
  zonas: ZonaRep[];
  total: number;
  fonte: "mandato" | "eleicao";
}) {
  const max = Math.max(1, ...zonas.map((z) => z.total));
  const byZona = new Map(zonas.map((z) => [z.zona, z.total]));
  const comReps = zonas.filter((z) => z.total > 0).length;
  const campea = [...zonas].sort((a, b) => b.total - a.total)[0];
  const temDados = total > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold sm:text-base">
                Representantes por zona
              </p>
              <p className="text-xs text-muted-foreground">
                {fonte === "mandato"
                  ? "Mandato vigente"
                  : "Eleitos (resultado da eleição)"}{" "}
                · {total} no total
              </p>
            </div>
          </div>
          {temDados && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <Trophy className="h-3.5 w-3.5" />
                {ZONA_LABEL[campea.zona]} lidera · {campea.total}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                Cobertura {comReps}/{zonas.length}
              </span>
            </div>
          )}
        </div>

        {/* Tabuleiro-compasso */}
        <div className="relative mx-auto max-w-xs">
          <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-[10px] font-bold text-slate-300">
            N
          </span>
          <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-300">
            S
          </span>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">
            L
          </span>
          <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">
            O
          </span>
          <div className="grid grid-cols-3 gap-2 px-4">
            {LAYOUT.map((z, i) => {
              if (!z)
                return (
                  <div
                    key={i}
                    className="aspect-square rounded-xl border border-dashed border-slate-100"
                  />
                );
              const n = byZona.get(z) ?? 0;
              const lider = campea && z === campea.zona && n > 0;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-xl p-1 text-center transition",
                    tileColor(n / max),
                  )}
                >
                  {lider && <Crown className="mb-0.5 h-3.5 w-3.5" />}
                  <span className="text-xl font-black leading-none sm:text-2xl">
                    {n}
                  </span>
                  <span className="mt-0.5 text-[10px] font-semibold uppercase leading-none opacity-90">
                    {ZONA_LABEL[z]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {temDados ? (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Quanto mais escura a zona, mais representantes. Esquemático (não
            geográfico).
          </p>
        ) : (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Os representantes por zona aparecem conforme os locais encerram e são
            homologados.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
