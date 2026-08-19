"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import type { Apuracao } from "@/lib/reports";
import { searchScore, searchTokens } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  undefined: "Aguardando agendamento",
  open: "Em andamento",
  closed: "Encerrada",
  upcoming: "Não iniciada",
};
const STATUS_VARIANT: Record<
  Apuracao["status"],
  "success" | "destructive" | "secondary" | "outline"
> = {
  undefined: "outline",
  open: "success",
  closed: "destructive",
  upcoming: "secondary",
};
const MAX_ELEITOS_NOMES = 8;

export type ApuracaoSort =
  | "fim_desc"
  | "fim_asc"
  | "votos_desc"
  | "nome_asc"
  | "orgao_asc";

const SORTS: { value: ApuracaoSort; label: string }[] = [
  { value: "fim_desc", label: "Encerramento (recente → antigo)" },
  { value: "fim_asc", label: "Encerramento (antigo → recente)" },
  { value: "votos_desc", label: "Mais votos" },
  { value: "nome_asc", label: "Nome (A–Z)" },
  { value: "orgao_asc", label: "Órgão (A–Z)" },
];

const ALL = "all";
const MENOS_INF = Number.NEGATIVE_INFINITY;
const MAIS_INF = Number.POSITIVE_INFINITY;

function comparar(sort: ApuracaoSort) {
  return (a: Apuracao, b: Apuracao) => {
    switch (sort) {
      case "fim_desc":
        return (b.fimSort ?? MENOS_INF) - (a.fimSort ?? MENOS_INF);
      case "fim_asc":
        return (a.fimSort ?? MAIS_INF) - (b.fimSort ?? MAIS_INF);
      case "votos_desc":
        return b.totalVotos - a.totalVotos || a.nome.localeCompare(b.nome);
      case "nome_asc":
        return a.nome.localeCompare(b.nome);
      case "orgao_asc":
        return a.orgao.localeCompare(b.orgao) || a.nome.localeCompare(b.nome);
    }
  };
}

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
          <div className="min-w-0">
            <CardTitle className="text-base">{a.nome}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">
              {a.orgao} · Zona {a.zona}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[a.status]} className="shrink-0">
            {STATUS_LABEL[a.status]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Janela: {a.inicioDisplay} até {a.fimDisplay} · {a.totalCandidatos}{" "}
          candidato(s) · {a.vagas} {a.vagas === 1 ? "vaga" : "vagas"} ·{" "}
          <strong className="text-foreground">
            {a.totalVotos} {a.totalVotos === 1 ? "voto" : "votos"}
          </strong>
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
 * Lista de apurações por local. Filtra por TEXTO (nome/órgão/zona) e,
 * opcionalmente, por ÓRGÃO e ZONA (dropdowns), e ORDENA por ciclo de vida
 * (encerramento recente por padrão na Encerradas). Os cards ocultos por filtro
 * seguem visíveis na IMPRESSÃO (`print:block`) — o relatório impresso é completo.
 */
export function ApuracoesList({
  apuracoes,
  orgaos,
  zonas,
  defaultSort = "orgao_asc",
  showControls = false,
}: {
  apuracoes: Apuracao[];
  /** Se informado, mostra o filtro de órgão (derivado das apurações). */
  orgaos?: string[];
  /** Se informado, mostra o filtro de zona. */
  zonas?: string[];
  defaultSort?: ApuracaoSort;
  /** Mostra a barra de ordenação/filtros (Encerradas). */
  showControls?: boolean;
}) {
  const [q, setQ] = useState("");
  const [orgao, setOrgao] = useState("");
  const [zona, setZona] = useState("");
  const [sort, setSort] = useState<ApuracaoSort>(defaultSort);

  const tokens = searchTokens(q);
  const casa = (a: Apuracao) =>
    (tokens.length === 0 ||
      searchScore(`${a.nome} ${a.orgao} ${a.zona}`, tokens) > 0) &&
    (orgao === "" || a.orgao === orgao) &&
    (zona === "" || a.zona === zona);

  // Ordena TODAS (o filtro só decide o que fica visível na tela).
  const ordenadas = useMemo(
    () => [...apuracoes].sort(comparar(sort)),
    [apuracoes, sort],
  );

  const visiveis = ordenadas.filter(casa).length;
  const temFiltro = q.trim() !== "" || orgao !== "" || zona !== "";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 print:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar local por nome, órgão ou zona..."
            className="h-11 pl-9"
          />
        </div>

        {showControls && (
          <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
            <div className="col-span-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground lg:col-span-1">
              <Filter className="h-3.5 w-3.5" />
              Ordenar / filtrar
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as ApuracaoSort)}>
              <SelectTrigger className="col-span-2 h-10 lg:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {orgaos && orgaos.length > 0 && (
              <div className="col-span-2 lg:w-56">
                <Combobox
                  value={orgao}
                  onChange={setOrgao}
                  options={orgaos.map((o) => ({ value: o, label: o }))}
                  placeholder="Todos os órgãos"
                  searchPlaceholder="Buscar órgão..."
                  clearLabel="Todos os órgãos"
                />
              </div>
            )}

            {zonas && zonas.length > 0 && (
              <Select
                value={zona || ALL}
                onValueChange={(v) => setZona(v === ALL ? "" : v)}
              >
                <SelectTrigger className="h-10 lg:w-40">
                  <SelectValue placeholder="Zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as zonas</SelectItem>
                  {zonas.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {temFiltro && (
              <Button
                variant="ghost"
                size="sm"
                className="col-span-2 lg:w-auto"
                onClick={() => {
                  setQ("");
                  setOrgao("");
                  setZona("");
                }}
              >
                <X className="mr-1 h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {temFiltro
            ? `${visiveis} de ${apuracoes.length} locais`
            : `${apuracoes.length} local(is)`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1">
        {ordenadas.map((a) => (
          <div key={a.id} className={cn(!casa(a) && "hidden print:block")}>
            <ApuracaoCard a={a} />
          </div>
        ))}
      </div>
    </div>
  );
}
