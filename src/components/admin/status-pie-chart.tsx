"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { StatusFatia } from "@/lib/dashboard";

// 4 status mutuamente exclusivos. "Aguardando Diretoria" (sem data) é o novo —
// cinza-claro, para ler como "ainda não entrou no fluxo"; "Agendadas" fica em
// âmbar (já tem data e vai abrir).
const CORES: Record<string, string> = {
  "Aguardando Diretoria": "#cbd5e1", // slate-300 (sem data ainda)
  Agendadas: "#f59e0b", // amber
  "Em Andamento": "#10b981", // emerald
  Encerrados: "#64748b", // slate
  // Rótulo antigo, mantido por compatibilidade com dados já renderizados.
  "Aguardando Início": "#f59e0b",
};

export function StatusPieChart({ data }: { data: StatusFatia[] }) {
  // Fatias zeradas poluem a legenda (ex.: nenhuma encerrada ainda).
  const fatias = data.filter((d) => d.valor > 0);
  const total = fatias.reduce((s, d) => s + d.valor, 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Nenhum local cadastrado.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={fatias}
          dataKey="valor"
          nameKey="status"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {fatias.map((d) => (
            <Cell key={d.status} fill={CORES[d.status] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 13,
          }}
          formatter={(value: number, name: string) => [
            `${value} local(is)`,
            name,
          ]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          formatter={(value: string) => (
            <span className="text-xs text-slate-600">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
