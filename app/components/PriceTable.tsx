import type { SearchRow } from "@/lib/db";

interface Props {
  history: SearchRow[];
  currency: string;
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(price);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default function PriceTable({ history, currency }: Props) {
  const sorted = [...history].sort(
    (a, b) => new Date(b.search_date).getTime() - new Date(a.search_date).getTime(),
  );

  if (sorted.length === 0) {
    return <div className="empty-state">Nenhuma busca registrada ainda.</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Buscado em</th>
          <th>Ida</th>
          <th>Volta</th>
          <th>Preço</th>
          <th>Cia</th>
          <th>Paradas</th>
        </tr>
      </thead>
      <tbody>
        {sorted.slice(0, 100).map((row) => (
          <tr key={row.id} className={row.is_alert ? "alert" : undefined}>
            <td>{new Date(row.search_date).toLocaleString("pt-BR")}</td>
            <td>{formatDate(row.departure_date)}</td>
            <td>{formatDate(row.return_date)}</td>
            <td>
              {formatPrice(row.price, currency)}
              {row.is_alert ? <span className="badge alert">alvo</span> : null}
            </td>
            <td>{row.airline ?? "—"}</td>
            <td>{row.stops ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
