import { activeRoutes, monitoringPeriodEnded, readConfig, splitMonthsForRotation } from "../lib/config";
import { closeDb } from "../lib/db";
import { reconfirmBestOfDay, searchRouteForMonths } from "../lib/search";

type RunType = "morning" | "night";

function parseRunType(): RunType {
  const arg = process.argv.find((a) => a.startsWith("--run="));
  const value = arg?.split("=")[1];
  if (value === "morning" || value === "night") return value;
  throw new Error('Uso: run-search.ts --run=morning|night');
}

async function main() {
  const runType = parseRunType();
  const config = readConfig();
  const today = new Date();

  if (monitoringPeriodEnded(config, today)) {
    console.log(
      `Período de monitoramento (170 dias desde ${config.monitoring_start_date}) já terminou. Nada a fazer.`,
    );
    return;
  }

  const { morning, night } = splitMonthsForRotation(config.allowed_months);
  const months = runType === "morning" ? morning : night;
  const routes = activeRoutes(config);

  console.log(`Execução "${runType}" — rotas ativas: ${routes.map((r) => r.id).join(", ")}`);
  console.log(`Meses desta execução: ${months.join(", ") || "(nenhum)"}`);

  for (const route of routes) {
    console.log(`Buscando ${route.origin} -> ${route.destination}...`);
    const results = await searchRouteForMonths(route, months, config, today);
    console.log(`  ${results.length} preço(s) confirmado(s) para ${route.id}`);
  }

  if (runType === "night") {
    console.log("Reconfirmando melhor preço do dia por rota...");
    for (const route of routes) {
      await reconfirmBestOfDay(route, today);
    }
  }

  console.log("Busca concluída.");
  closeDb();
}

main().catch((err) => {
  console.error("Erro fatal na busca:", err);
  process.exit(1);
});
