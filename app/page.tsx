import Link from "next/link";
import { readConfig } from "@/lib/config";
import { getCheapestPerRoute } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(price);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export default function OverviewPage() {
  const config = readConfig();
  const cheapest = getCheapestPerRoute();

  return (
    <>
      <h1>Visão geral</h1>
      <p className="subtitle">Menores preços encontrados por rota ativa.</p>

      {config.routes.filter((r) => r.active).length === 0 && (
        <div className="empty-state">Nenhuma rota ativa configurada ainda.</div>
      )}

      <div className="grid">
        {config.routes
          .filter((r) => r.active)
          .map((route) => {
            const best = cheapest[route.id];
            const isAlert = best ? best.is_alert === 1 : false;
            return (
              <Link
                key={route.id}
                href={`/routes/${route.id}`}
                className={`route-card${isAlert ? " alert" : ""}`}
              >
                <div className="route-title">
                  {route.origin} → {route.destination}
                  {isAlert && <span className="badge alert">abaixo do alvo</span>}
                </div>
                {best ? (
                  <>
                    <div className={`route-price${isAlert ? " alert" : ""}`}>
                      {formatPrice(best.price, best.currency)}
                    </div>
                    <div className="route-meta">
                      {formatDate(best.departure_date)} → {formatDate(best.return_date)}
                      {best.airline ? ` · ${best.airline}` : ""}
                      {best.stops !== null ? ` · ${best.stops} parada(s)` : ""}
                    </div>
                  </>
                ) : (
                  <div className="route-meta">Ainda sem buscas registradas</div>
                )}
                <div className="route-meta" style={{ marginTop: 8 }}>
                  Alvo: {formatPrice(route.price_threshold, route.currency)}
                </div>
              </Link>
            );
          })}
      </div>
    </>
  );
}
