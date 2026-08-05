"use client";

import { useState } from "react";
import type { AppConfig, Route } from "@/lib/config";

interface Props {
  initialConfig: AppConfig;
}

function slugify(origin: string, destination: string): string {
  return `${origin.toLowerCase()}-${destination.toLowerCase()}`;
}

const emptyForm = { origin: "", destination: "", price_threshold: "", currency: "BRL" };

export default function RoutesManager({ initialConfig }: Props) {
  const [config, setConfig] = useState<AppConfig>(initialConfig);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const activeCount = config.routes.filter((r) => r.active).length;

  async function persist(nextConfig: AppConfig) {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextConfig),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      setConfig(nextConfig);
      setStatus({ type: "success", text: "Salvo. O dashboard vai refletir a mudança em ~1 min (redeploy)." });
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar" });
    } finally {
      setSaving(false);
    }
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const origin = form.origin.toUpperCase().trim();
    const destination = form.destination.toUpperCase().trim();
    const threshold = parseFloat(form.price_threshold);

    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
      setStatus({ type: "error", text: "Origem e destino devem ser códigos IATA de 3 letras (ex: FOR, FCO)" });
      return;
    }
    if (!threshold || threshold <= 0) {
      setStatus({ type: "error", text: "Informe um preço-alvo válido" });
      return;
    }

    const newRoute: Route = {
      id: slugify(origin, destination),
      origin,
      destination,
      active: true,
      price_threshold: threshold,
      currency: form.currency.toUpperCase(),
    };

    if (config.routes.some((r) => r.id === newRoute.id)) {
      setStatus({ type: "error", text: "Já existe uma rota com essa origem/destino" });
      return;
    }
    if (activeCount >= config.max_active_routes) {
      setStatus({
        type: "error",
        text: `Limite de ${config.max_active_routes} rotas ativas atingido. Desative outra rota antes de adicionar.`,
      });
      return;
    }

    const nextConfig = { ...config, routes: [...config.routes, newRoute] };
    persist(nextConfig);
    setForm(emptyForm);
  }

  function toggleActive(id: string) {
    const route = config.routes.find((r) => r.id === id);
    if (!route) return;
    if (!route.active && activeCount >= config.max_active_routes) {
      setStatus({
        type: "error",
        text: `Limite de ${config.max_active_routes} rotas ativas atingido.`,
      });
      return;
    }
    const nextConfig = {
      ...config,
      routes: config.routes.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    };
    persist(nextConfig);
  }

  function removeRoute(id: string) {
    const nextConfig = { ...config, routes: config.routes.filter((r) => r.id !== id) };
    persist(nextConfig);
  }

  return (
    <>
      <div className="card">
        <h2>
          Rotas ({activeCount}/{config.max_active_routes} ativas)
        </h2>
        {config.routes.length === 0 && <div className="empty-state">Nenhuma rota cadastrada.</div>}
        {config.routes.map((route) => (
          <div key={route.id} className="route-list-item">
            <div>
              <strong>
                {route.origin} → {route.destination}
              </strong>
              <div className="route-meta">
                Alvo: {route.price_threshold} {route.currency} ·{" "}
                {route.active ? "ativa" : "inativa"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="secondary" onClick={() => toggleActive(route.id)} disabled={saving}>
                {route.active ? "Desativar" : "Ativar"}
              </button>
              <button className="danger" onClick={() => removeRoute(route.id)} disabled={saving}>
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Adicionar rota</h2>
        <form onSubmit={handleAdd}>
          <label>
            Origem (IATA)
            <input
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              placeholder="FOR"
              maxLength={3}
            />
          </label>
          <label>
            Destino (IATA)
            <input
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="FCO"
              maxLength={3}
            />
          </label>
          <label>
            Preço-alvo
            <input
              type="number"
              value={form.price_threshold}
              onChange={(e) => setForm({ ...form, price_threshold: e.target.value })}
              placeholder="3500"
            />
          </label>
          <label>
            Moeda
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="BRL">BRL</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Adicionar rota"}
          </button>
        </form>
      </div>

      {status && <div className={`status-msg ${status.type}`}>{status.text}</div>}
    </>
  );
}
