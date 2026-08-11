import { readConfig } from "@/lib/config";

export default function RoutesPage() {
  const config = readConfig();

  return (
    <>
      <h1>Rotas</h1>
      <p className="subtitle">
        Este dashboard é um site estático — edite <code>data/config.json</code> no repositório
        (localmente ou direto pela interface do GitHub) e faça push para adicionar, ativar/desativar
        ou remover rotas. O site republica sozinho a cada push.
      </p>

      <div className="card">
        <h2>
          Rotas ({config.routes.filter((r) => r.active).length}/{config.max_active_routes} ativas)
        </h2>
        {config.routes.length === 0 && <div className="empty-state">Nenhuma rota cadastrada.</div>}
        {config.routes.map((route) => (
          <div key={route.id} className="route-list-item">
            <div>
              <strong>
                {route.origin} → {route.destination}
              </strong>
              <div className="route-meta">
                id: {route.id} · Alvo: {route.price_threshold} {route.currency}
              </div>
            </div>
            <span className={`badge${route.active ? " good" : ""}`}>
              {route.active ? "ativa" : "inativa"}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Como adicionar uma rota</h2>
        <p className="route-meta">
          Edite <code>data/config.json</code> e adicione um item em <code>routes</code>, por exemplo:
        </p>
        <pre style={{ fontSize: "0.8rem", overflowX: "auto" }}>
{`{
  "id": "for-lis",
  "origin": "FOR",
  "destination": "LIS",
  "active": true,
  "price_threshold": 2800,
  "currency": "BRL"
}`}
        </pre>
        <p className="route-meta">
          Respeite o limite de <code>max_active_routes</code> ({config.max_active_routes}) rotas
          ativas simultâneas.
        </p>
      </div>
    </>
  );
}
