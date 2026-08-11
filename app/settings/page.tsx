import { readConfig } from "@/lib/config";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export default function SettingsPage() {
  const config = readConfig();

  return (
    <>
      <h1>Configurações</h1>
      <p className="subtitle">
        Este dashboard é um site estático — edite <code>data/config.json</code> no repositório
        (localmente ou direto pela interface do GitHub) e faça push. O site republica sozinho a
        cada push.
      </p>

      <div className="card">
        <h2>Meses permitidos para busca</h2>
        <div className="months-grid">
          {MONTH_NAMES.map((name, idx) => {
            const month = idx + 1;
            const allowed = config.allowed_months.includes(month);
            return (
              <span key={month} className={`badge${allowed ? " good" : ""}`}>
                {name}
              </span>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Outros parâmetros</h2>
        <table>
          <tbody>
            <tr>
              <td>Duração da viagem</td>
              <td>{config.trip_duration_days} dias</td>
            </tr>
            <tr>
              <td>Horizonte de busca</td>
              <td>{config.search_horizon_days} dias à frente</td>
            </tr>
            <tr>
              <td>Limite de rotas ativas simultâneas</td>
              <td>{config.max_active_routes}</td>
            </tr>
            <tr>
              <td>Início do monitoramento</td>
              <td>{config.monitoring_start_date}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
