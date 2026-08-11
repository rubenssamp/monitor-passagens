import { activeRoutes, monitoringPeriodEnded, readConfig } from "../lib/config";
import { closeDb } from "../lib/db";
import { searchRouteForMonths } from "../lib/search";

try {
  // Carrega .env para uso local (npm run search). No GitHub Actions as variáveis já vêm
  // injetadas como env reais via secrets, então a ausência do arquivo aqui é esperada.
  process.loadEnvFile();
} catch {
  // sem .env — ok em CI
}

async function main() {
  const config = readConfig();
  const today = new Date();

  if (monitoringPeriodEnded(config, today)) {
    console.log(
      `Período de monitoramento (170 dias desde ${config.monitoring_start_date}) já terminou. Nada a fazer.`,
    );
    return;
  }

  const routes = activeRoutes(config);
  console.log(`Rotas ativas: ${routes.map((r) => r.id).join(", ")}`);
  console.log(`Meses permitidos: ${config.allowed_months.join(", ")}`);

  for (const route of routes) {
    console.log(`Buscando ${route.origin} -> ${route.destination}...`);
    const results = await searchRouteForMonths(route, config.allowed_months, config, today);
    console.log(`  ${results.length} preço(s) registrado(s) para ${route.id}`);
  }

  console.log("Busca concluída.");
  closeDb();
}

main().catch((err) => {
  console.error("Erro fatal na busca:", err);
  process.exit(1);
});
