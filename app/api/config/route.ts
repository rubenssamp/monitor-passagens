import { NextRequest, NextResponse } from "next/server";
import type { AppConfig, Route } from "@/lib/config";
import { commitConfig } from "@/lib/github";

export const runtime = "nodejs";

function isValidRoute(r: unknown): r is Route {
  if (typeof r !== "object" || r === null) return false;
  const route = r as Record<string, unknown>;
  return (
    typeof route.id === "string" &&
    route.id.length > 0 &&
    typeof route.origin === "string" &&
    /^[A-Z]{3}$/.test(route.origin) &&
    typeof route.destination === "string" &&
    /^[A-Z]{3}$/.test(route.destination) &&
    typeof route.active === "boolean" &&
    typeof route.price_threshold === "number" &&
    route.price_threshold > 0 &&
    typeof route.currency === "string" &&
    route.currency.length === 3
  );
}

function validateConfig(body: unknown): { valid: true; config: AppConfig } | { valid: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "Corpo inválido" };
  }
  const c = body as Record<string, unknown>;

  if (typeof c.monitoring_start_date !== "string") {
    return { valid: false, error: "monitoring_start_date inválido" };
  }
  if (typeof c.search_horizon_days !== "number" || c.search_horizon_days <= 0) {
    return { valid: false, error: "search_horizon_days inválido" };
  }
  if (typeof c.trip_duration_days !== "number" || c.trip_duration_days <= 0) {
    return { valid: false, error: "trip_duration_days inválido" };
  }
  if (
    !Array.isArray(c.allowed_months) ||
    c.allowed_months.length === 0 ||
    !c.allowed_months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)
  ) {
    return { valid: false, error: "allowed_months inválido (deve ter meses de 1 a 12)" };
  }
  if (typeof c.max_active_routes !== "number" || c.max_active_routes <= 0) {
    return { valid: false, error: "max_active_routes inválido" };
  }
  if (!Array.isArray(c.routes) || !c.routes.every(isValidRoute)) {
    return { valid: false, error: "routes inválido" };
  }

  const activeCount = (c.routes as Route[]).filter((r) => r.active).length;
  if (activeCount > c.max_active_routes) {
    return {
      valid: false,
      error: `Número de rotas ativas (${activeCount}) excede o limite max_active_routes (${c.max_active_routes})`,
    };
  }

  return { valid: true, config: c as unknown as AppConfig };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const result = validateConfig(body);

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    await commitConfig(result.config, "chore: atualizar config via dashboard");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao salvar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
