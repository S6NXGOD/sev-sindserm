"use client";

import { Lock } from "lucide-react";
import {
  MODULOS,
  PRESETS,
  presetPermissoes,
  type Modulo,
  type Nivel,
  type Permissoes,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

// Módulos só-de-leitura mostram 2 botões; editáveis mostram os 3.
const NIVEIS_LEITURA: Nivel[] = ["NONE", "VIEW"];
const NIVEIS_EDICAO: Nivel[] = ["NONE", "VIEW", "EDIT"];

const NIVEL_TXT: Record<Nivel, string> = {
  NONE: "Sem acesso",
  VIEW: "Só visualizar",
  EDIT: "Visualizar e editar",
};

/** Um botão de nível (verde quando selecionado). */
function BotaoNivel({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-colors",
        ativo
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Grade de permissões por módulo (controlada). Reproduz o padrão do print:
 * por módulo, escolhe-se "Sem acesso / Só visualizar / Visualizar e editar".
 * Presets no topo preenchem tudo de uma vez.
 */
export function PermissoesGrid({
  value,
  onChange,
}: {
  value: Permissoes;
  onChange: (p: Permissoes) => void;
}) {
  function setModulo(m: Modulo, n: Nivel) {
    onChange({ ...value, [m]: n });
  }

  // Agrupa os módulos por "grupo" preservando a ordem de MODULOS.
  const grupos: { nome: string; itens: typeof MODULOS }[] = [];
  for (const mod of MODULOS) {
    const g = grupos.find((x) => x.nome === mod.grupo);
    if (g) g.itens.push(mod);
    else grupos.push({ nome: mod.grupo, itens: [mod] });
  }

  return (
    <div className="space-y-4">
      {/* Presets rápidos */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Aplicar um preset (você pode ajustar depois):
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.desc}
              onClick={() => onChange(presetPermissoes(p.key))}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="h-4 w-4 text-muted-foreground" />
        Permissões de módulos
      </div>

      {grupos.map((grupo) => (
        <div key={grupo.nome} className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {grupo.nome}
          </p>
          {grupo.itens.map((mod) => {
            const niveis = mod.editavel ? NIVEIS_EDICAO : NIVEIS_LEITURA;
            return (
              <div
                key={mod.key}
                className="rounded-lg border bg-card p-3 shadow-sm"
              >
                <p className="mb-2 text-sm font-medium">{mod.label}</p>
                <div className="flex gap-1.5">
                  {niveis.map((n) => (
                    <BotaoNivel
                      key={n}
                      ativo={value[mod.key] === n}
                      onClick={() => setModulo(mod.key, n)}
                    >
                      {NIVEL_TXT[n]}
                    </BotaoNivel>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
