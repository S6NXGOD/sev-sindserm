"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RitmoPonto } from "@/lib/dashboard";

export function RitmoChart({ data }: { data: RitmoPonto[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Nenhum voto registrado hoje.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="ritmoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(222.2 47.4% 11.2%)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="hsl(222.2 47.4% 11.2%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="hora"
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 13,
          }}
          labelStyle={{ fontWeight: 600 }}
          formatter={(value: number) => [`${value} voto(s)`, "Votos"]}
        />
        <Area
          type="monotone"
          dataKey="votos"
          stroke="hsl(222.2 47.4% 11.2%)"
          strokeWidth={2}
          fill="url(#ritmoFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
