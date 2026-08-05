import { notFound } from "next/navigation";
import Link from "next/link";
import { readConfig } from "@/lib/config";
import { getHistoryForRoute } from "@/lib/db";
import PriceChart from "@/app/components/PriceChart";
import PriceTable from "@/app/components/PriceTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const config = readConfig();
  const route = config.routes.find((r) => r.id === id);
  if (!route) notFound();

  const history = getHistoryForRoute(route.id);

  return (
    <>
      <Link href="/" className="route-meta">
        ← Visão geral
      </Link>
      <h1 style={{ marginTop: 12 }}>
        {route.origin} → {route.destination}
      </h1>
      <p className="subtitle">
        Alvo de preço:{" "}
        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: route.currency }).format(
          route.price_threshold,
        )}{" "}
        · {route.active ? "rota ativa" : "rota inativa"}
      </p>

      <div className="card">
        <h2>Evolução de preço</h2>
        <PriceChart history={history} threshold={route.price_threshold} currency={route.currency} />
      </div>

      <div className="card">
        <h2>Histórico de buscas</h2>
        <PriceTable history={history} currency={route.currency} />
      </div>
    </>
  );
}
