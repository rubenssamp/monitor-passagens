import fs from "node:fs";
import path from "node:path";

export interface Route {
  id: string;
  origin: string;
  destination: string;
  active: boolean;
  price_threshold: number;
  currency: string;
}

export interface AppConfig {
  monitoring_start_date: string; // YYYY-MM-DD
  search_horizon_days: number;
  trip_duration_days: number;
  allowed_months: number[]; // 1-12, sorted
  max_active_routes: number;
  routes: Route[];
}

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function readConfig(): AppConfig {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as AppConfig;
}

/** Local-only write, used by scripts/dev. The dashboard writes via lib/github.ts instead. */
export function writeConfigLocal(config: AppConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function activeRoutes(config: AppConfig): Route[] {
  return config.routes.filter((r) => r.active).slice(0, config.max_active_routes);
}

/** Splits allowed_months (sorted) into two halves for the morning/night rotation. */
export function splitMonthsForRotation(
  allowedMonths: number[],
): { morning: number[]; night: number[] } {
  const sorted = [...allowedMonths].sort((a, b) => a - b);
  const mid = Math.ceil(sorted.length / 2);
  return { morning: sorted.slice(0, mid), night: sorted.slice(mid) };
}

export function daysSinceMonitoringStart(config: AppConfig, today = new Date()): number {
  const start = new Date(config.monitoring_start_date + "T00:00:00Z");
  const diffMs = today.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export const MONITORING_DURATION_DAYS = 170;

export function monitoringPeriodEnded(config: AppConfig, today = new Date()): boolean {
  return daysSinceMonitoringStart(config, today) > MONITORING_DURATION_DAYS;
}
