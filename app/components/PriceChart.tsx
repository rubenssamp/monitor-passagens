"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SearchRow } from "@/lib/db";

interface Props {
  history: SearchRow[];
  threshold: number;
  currency: string;
}

export default function PriceChart({ history, threshold, currency }: Props) {
  const data = history.map((row) => ({
    date: new Date(row.search_date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    price: row.price,
    departure: row.departure_date,
  }));

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

  if (data.length === 0) {
    return <div className="empty-state">Ainda sem histórico de preços para esta rota.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#262b38" />
        <XAxis dataKey="date" stroke="#9aa1b2" fontSize={12} />
        <YAxis
          stroke="#9aa1b2"
          fontSize={12}
          tickFormatter={(v) => formatPrice(v)}
          width={90}
        />
        <Tooltip
          contentStyle={{ background: "#14171f", border: "1px solid #262b38", borderRadius: 8 }}
          labelStyle={{ color: "#9aa1b2" }}
          formatter={(value: number) => [formatPrice(value), "Preço"]}
        />
        <ReferenceLine y={threshold} stroke="#ff5d5d" strokeDasharray="4 4" label={{ value: "Alvo", fill: "#ff5d5d", fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#5b8cff"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
