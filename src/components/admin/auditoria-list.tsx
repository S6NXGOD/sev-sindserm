"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { searchScore, searchTokens } from "@/lib/slug";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AuditRow = {
  id: string;
  quando: string;
  userNome: string;
  acao: string;
  alvo: string | null;
  detalhe: string | null;
};

/** Rótulo legível da ação (fallback: o próprio código). */
const ACAO_LABEL: Record<string, string> = {
  LOGIN: "Entrou no sistema",
  LOGOUT: "Saiu do sistema",
  TROCOU_SENHA: "Trocou a própria senha",
  CRIOU_USUARIO: "Criou usuário",
  EDITOU_USUARIO: "Editou usuário",
  ATIVOU_USUARIO: "Reativou usuário",
  DESATIVOU_USUARIO: "Desativou usuário",
  RESETOU_SENHA: "Redefiniu senha de usuário",
  EXCLUIU_USUARIO: "Excluiu usuário",
  DESLOGOU_TODOS: "Deslogou todos os usuários",
  EDITOU_PERFIL: "Editou o próprio perfil",
  CRIOU_LOCAL: "Cadastrou local",
  EDITOU_LOCAL: "Editou dados do local",
  ALTEROU_LINK: "Alterou o link do local",
  DEFINIU_LIMITE: "Definiu limite de votos",
  AGENDOU_VOTACAO: "Agendou/alterou a votação",
  ENCERROU: "Encerrou a votação",
  REABRIU: "Reabriu a votação",
  EXCLUIU_LOCAL: "Excluiu local",
  ADICIONOU_CANDIDATO: "Adicionou candidato",
  IMPORTOU_CANDIDATOS: "Importou candidatos (lote)",
  EXCLUIU_CANDIDATO: "Excluiu candidato",
  RENUNCIA: "Registrou 'não assume a vaga'",
  REVERTEU_RENUNCIA: "Reverteu 'não assume a vaga'",
  CRIOU_PLEITO: "Criou pleito",
  EDITOU_PLEITO: "Editou pleito",
  EXCLUIU_PLEITO: "Excluiu pleito",
  CLONOU_PLEITO: "Clonou pleito",
};

/** Cor por família de ação. */
function acaoTone(acao: string): string {
  if (acao.startsWith("EXCLUIU") || acao === "DESLOGOU_TODOS")
    return "border-rose-300 bg-rose-50 text-rose-700";
  if (acao === "ENCERROU" || acao === "DESATIVOU_USUARIO")
    return "border-amber-300 bg-amber-50 text-amber-700";
  if (acao === "LOGIN" || acao === "AGENDOU_VOTACAO" || acao.startsWith("CRIOU"))
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  return "border-slate-300 bg-slate-100 text-slate-600";
}

const FILTROS = [
  { value: "todos", label: "Todas as ações" },
  { value: "auth", label: "Login / Logout / Senha" },
  { value: "usuarios", label: "Usuários" },
  { value: "votacao", label: "Locais / Votação" },
  { value: "pleitos", label: "Pleitos" },
];

function categoria(acao: string): string {
  if (
    ["LOGIN", "LOGOUT", "TROCOU_SENHA", "DESLOGOU_TODOS", "EDITOU_PERFIL"].includes(
      acao,
    )
  )
    return "auth";
  if (acao.endsWith("_USUARIO") || acao === "RESETOU_SENHA") return "usuarios";
  if (acao.endsWith("_PLEITO")) return "pleitos";
  return "votacao";
}

export function AuditoriaList({ rows }: { rows: AuditRow[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("todos");

  const tokens = searchTokens(q);
  const filtradas = useMemo(
    () =>
      rows.filter((r) => {
        if (cat !== "todos" && categoria(r.acao) !== cat) return false;
        if (tokens.length === 0) return true;
        const hay = `${r.userNome} ${ACAO_LABEL[r.acao] ?? r.acao} ${r.alvo ?? ""} ${r.detalhe ?? ""}`;
        return searchScore(hay, tokens) > 0;
      }),
    [rows, cat, tokens],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por pessoa, ação ou alvo..."
            className="h-11 pl-9"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-11 sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTROS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtradas.length} de {rows.length} registro(s)
      </p>

      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 py-12 text-center text-sm text-muted-foreground">
          Nenhum registro para este filtro.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {filtradas.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 border-b p-3 last:border-b-0">
              <Badge variant="outline" className={`shrink-0 ${acaoTone(r.acao)}`}>
                {ACAO_LABEL[r.acao] ?? r.acao}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <strong>{r.userNome}</strong>
                  {r.alvo ? (
                    <>
                      {" "}
                      → <span className="text-muted-foreground">{r.alvo}</span>
                    </>
                  ) : null}
                </p>
                {r.detalhe && (
                  <p className="truncate text-xs text-muted-foreground">
                    {r.detalhe}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {r.quando}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
