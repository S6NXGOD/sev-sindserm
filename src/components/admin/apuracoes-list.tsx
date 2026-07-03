"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Apuracao } from "@/lib/reports";
import { normalizeForSearch } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<Apuracao["status"], string> = {
  open: "Em andamento",
  closed: "Encerrada",
  upcoming: "Não iniciada",
};
const STATUS_VARIANT: Record<
  Apuracao["status"],
  "success" | "destructive" | "secondary"
> = {
  open: "success",
  closed: "destructive",
  upcoming: "secondary",
};
const MAX_ELEITOS_NOMES = 8;

/**
 * Card de apuração de UM local com o ranking COLAPSÁVEL. Na tela o ranking fica
 * recolhido por padrão (lista compacta); na IMPRESSÃO ele é sempre exibido
 * (`print:block`), então o relatório/PDF continua completo.
 */
function ApuracaoCard({ a }: { a: Apuracao }) {
  const [aberto, setAberto] = useState(false);
  const semVotos = a.totalVotos === 0;
  const eleitosMostrados = a.eleitos.slice(0, MAX_ELEITOS_NOMES);
  const eleitosRestantes = a.eleitos.length - eleitosMostrados.length;
  const empatadosMostrados = a.empatados.slice(0, MAX_ELEITOS_NOMES);
  const semVotosCount = a.totalCandidatos - a.votadosCount;
  const naoListados = a.votadosCount - a.ranking.length;

  return (
    <Card className="break-inside-avoid">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{a.nome}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {a.orgao} · Zona {a.zona}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[a.status]}>
            {STATUS_LABEL[a.status]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Janela: {a.inicioDisplay} até {a.fimDisplay} · {a.totalCandidatos}{" "}
          candidato(s) · {a.vagas} {a.vagas === 1 ? "vaga" : "vagas"} ·{" "}
          {a.totalVotos} {a.totalVotos === 1 ? "voto" : "votos"}
          {a.voteLimit ? ` (limite ${a.voteLimit})` : ""}
        </p>
        {semVotos ? (
          <p className="text-sm text-muted-foreground">Sem votos.</p>
        ) : (
          <div className="text-sm">
            {a.eleitos.length > 0 && (
              <p className="font-medium text-emerald-700">
                {a.status === "closed" ? "Eleito(s)" : "Parcial (projeção)"}:{" "}
                {eleitosMostrados.join(", ")}
                {eleitosRestantes > 0 ? ` +${eleitosRestantes}` : ""}
              </p>
            )}
            {a.temEmpate && (
              <p className="font-medium text-amber-700">
                Empate para {a.vagasEmDisputa}{" "}
                {a.vagasEmDisputa === 1 ? "vaga" : "vagas"}:{" "}
                {empatadosMostrados.join(", ")} — necessário desempate.
              </p>
            )}
          </div>
        )}
      </CardHeader>

      {!semVotos && (
        <>
          {/* Alternador (só na tela). */}
          <div className="px-6 pb-3 print:hidden">
            <button
              type="button"
              onClick={() => setAberto((o) => !o)}
              aria-expanded={aberto}
              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              <span>
                {aberto ? "Ocultar" : "Ver"} ranking ({a.votadosCount})
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  aberto && "rotate-180",
                )}
              />
            </button>
          </div>
          {/* Ranking: recolhido na tela (hidden); SEMPRE visível na impressão. */}
          <CardContent className={cn("pt-0", !aberto && "hidden", "print:block")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidato</TableHead>
                  <TableHead className="text-right">Votos</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.ranking.map((c, i) => (
                  <TableRow key={`${a.id}-${i}`}>
                    <TableCell className={c.eleito ? "font-semibold" : undefined}>
                      <span className="inline-flex items-center gap-2">
                        {i + 1}. {c.nome}
                        {c.eleito ? (
                          <Badge variant="success">Eleito</Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-sky-300 text-sky-700"
                          >
                            Suplente
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{c.votos}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {c.pct}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(naoListados > 0 || semVotosCount > 0) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {naoListados > 0 &&
                  `+${naoListados} candidato(s) com votos não listados. `}
                {semVotosCount > 0 && `${semVotosCount} candidato(s) sem votos.`}
              </p>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}

/**
 * Lista de apurações por local, com filtro por texto (nome/órgão/zona). Os
 * cards que não casam com o filtro ficam ocultos na TELA, mas continuam visíveis
 * na IMPRESSÃO (`print:block`) — o relatório impresso é sempre completo.
 */
export function ApuracoesList({ apuracoes }: { apuracoes: Apuracao[] }) {
  const [q, setQ] = useState("");
  const termo = normalizeForSearch(q);
  const casa = (a: Apuracao) =>
    !termo ||
    normalizeForSearch(`${a.nome} ${a.orgao} ${a.zona}`).includes(termo);
  const qtd = termo ? apuracoes.filter(casa).length : apuracoes.length;

  return (
    <div className="space-y-3">
      <div className="relative print:hidden">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar local por nome, órgão ou zona..."
          className="pl-9"
        />
      </div>
      {termo && (
        <p className="text-xs text-muted-foreground print:hidden">
          {qtd} de {apuracoes.length} locais
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1">
        {apuracoes.map((a) => (
          <div key={a.id} className={cn(!casa(a) && "hidden print:block")}>
            <ApuracaoCard a={a} />
          </div>
        ))}
      </div>
    </div>
  );
}
