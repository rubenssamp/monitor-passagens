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

export function readConfig(): AppConfig {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as AppConfig;
}

export function activeRoutes(config: AppConfig): Route[] {
  return config.routes.filter((r) => r.active).slice(0, config.max_active_routes);
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
