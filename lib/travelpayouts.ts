const BASE_URL = "https://api.travelpayouts.com";

export interface CachedFare {
  departureDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  price: number;
  currency: string;
  airline: string | null;
  stops: number | null;
}

interface PricesForDatesResponse {
  success: boolean;
  data: Array<{
    departure_at: string; // ISO datetime
    return_at: string; // ISO datetime
    price: number;
    airline: string;
    transfers: number;
  }>;
  error: string | null;
}

/**
 * Travelpayouts/Aviasales Data API (/v3/prices_for_dates) — retorna as passagens mais baratas
 * que usuários do Aviasales realmente buscaram para o par origem/destino num mês, vindas de
 * cache (até 48h). Não é uma cotação ao vivo como a Amadeus, mas cobre bem o caso de uso de
 * "avisar quando o preço cair", com uma única chamada por mês/rota (sem etapa de confirmação).
 */
export async function searchCachedFaresForMonth(params: {
  origin: string;
  destination: string;
  departureMonth: string; // YYYY-MM
  currency: string;
}): Promise<CachedFare[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    throw new Error("TRAVELPAYOUTS_TOKEN não configurado");
  }

  const query = new URLSearchParams({
    origin: params.origin,
    destination: params.destination,
    departure_at: params.departureMonth,
    one_way: "false",
    sorting: "price",
    currency: params.currency,
    limit: "100",
    token,
  });

  const res = await fetch(`${BASE_URL}/aviasales/v3/prices_for_dates?${query.toString()}`, {
    headers: { "Accept-Encoding": "gzip, deflate" },
  });

  if (!res.ok) {
    throw new Error(`Travelpayouts GET prices_for_dates falhou: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as PricesForDatesResponse;
  if (!json.success) {
    throw new Error(`Travelpayouts retornou erro: ${json.error ?? "desconhecido"}`);
  }

  return json.data.map((item) => ({
    departureDate: item.departure_at.slice(0, 10),
    returnDate: item.return_at.slice(0, 10),
    price: item.price,
    currency: params.currency,
    airline: item.airline || null,
    stops: item.transfers ?? null,
  }));
}
