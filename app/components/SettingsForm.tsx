"use client";

import { useState } from "react";
import type { AppConfig } from "@/lib/config";

interface Props {
  initialConfig: AppConfig;
}

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export default function SettingsForm({ initialConfig }: Props) {
  const [config, setConfig] = useState<AppConfig>(initialConfig);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleMonth(month: number) {
    const has = config.allowed_months.includes(month);
    const allowed_months = has
      ? config.allowed_months.filter((m) => m !== month)
      : [...config.allowed_months, month].sort((a, b) => a - b);
    setConfig({ ...config, allowed_months });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (config.allowed_months.length === 0) {
      setStatus({ type: "error", text: "Marque pelo menos um mês permitido" });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      setStatus({ type: "success", text: "Salvo. O dashboard vai refletir a mudança em ~1 min (redeploy)." });
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Meses permitidos para busca
        <div className="months-grid">
          {MONTH_NAMES.map((name, idx) => {
            const month = idx + 1;
            return (
              <label key={month} className="month-chip">
                <input
                  type="checkbox"
                  checked={config.allowed_months.includes(month)}
                  onChange={() => toggleMonth(month)}
                />
                {name}
              </label>
            );
          })}
        </div>
      </label>

      <label>
        Duração da viagem (dias)
        <input
          type="number"
          value={config.trip_duration_days}
          onChange={(e) => setConfig({ ...config, trip_duration_days: parseInt(e.target.value) || 7 })}
        />
      </label>

      <label>
        Horizonte de busca (dias à frente)
        <input
          type="number"
          value={config.search_horizon_days}
          onChange={(e) =>
            setConfig({ ...config, search_horizon_days: parseInt(e.target.value) || 365 })
          }
        />
      </label>

      <label>
        Limite de rotas ativas simultâneas
        <input
          type="number"
          value={config.max_active_routes}
          onChange={(e) =>
            setConfig({ ...config, max_active_routes: parseInt(e.target.value) || 1 })
          }
        />
      </label>

      <button type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Salvar configurações"}
      </button>

      {status && <div className={`status-msg ${status.type}`}>{status.text}</div>}
    </form>
  );
}
