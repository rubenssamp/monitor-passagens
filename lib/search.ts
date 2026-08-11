import { AppConfig, Route } from "./config";
import { searchCachedFaresForMonth, CachedFare } from "./travelpayouts";
import { insertSearch, NewSearchRow } from "./db";

const TOP_N_RESULTS = 3;
// Os dados da Travelpayouts vêm de buscas reais em cache, então raramente batem a duração
// exata — aceita resultados a até 1 dia de distância dos trip_duration_days configurados.
const DURATION_TOLERANCE_DAYS = 1;

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatMonth(d: Date): string {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function tripDurationDays(fare: CachedFare): number {
  const dep = new Date(fare.departureDate + "T00:00:00Z");
  const ret = new Date(fare.returnDate + "T00:00:00Z");
  return Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Próxima ocorrência do mês (este ano ou o próximo) dentro do horizonte de busca configurado.
 * Retorna null se o mês já ficou fora do horizonte.
 */
export function nextOccurrenceOfMonth(
  month: number,
  config: AppConfig,
  today: Date,
): string | null {
  const horizonEnd = addDays(today, config.search_horizon_days);

  let year = today.getUTCFullYear();
  let monthStart = new Date(Date.UTC(year, month - 1, 1));
  let monthEnd = new Date(Date.UTC(year, month, 0));
  if (monthEnd < today) {
    year += 1;
    monthStart = new Date(Date.UTC(year, month - 1, 1));
    monthEnd = new Date(Date.UTC(year, month, 0));
  }

  if (monthStart > horizonEnd) return null;
  return formatMonth(monthStart);
}

async function searchRouteForMonth(
  route: Route,
  month: number,
  config: AppConfig,
  today: Date,
): Promise<CachedFare[]> {
  const departureMonth = nextOccurrenceOfMonth(month, config, today);
  if (!departureMonth) return [];

  const fares = await searchCachedFaresForMonth({
    origin: route.origin,
    destination: route.destination,
    departureMonth,
    currency: route.currency,
  });

  const matching = fares.filter(
    (fare) => Math.abs(tripDurationDays(fare) - config.trip_duration_days) <= DURATION_TOLERANCE_DAYS,
  );

  return [...matching].sort((a, b) => a.price - b.price).slice(0, TOP_N_RESULTS);
}

function persistFare(route: Route, fare: CachedFare, searchDate: string): void {
  const row: NewSearchRow = {
    route_id: route.id,
    search_date: searchDate,
    departure_date: fare.departureDate,
    return_date: fare.returnDate,
    price: fare.price,
    currency: fare.currency,
    airline: fare.airline,
    stops: fare.stops,
    is_alert: fare.price < route.price_threshold,
  };
  insertSearch(row);
}

export async function searchRouteForMonths(
  route: Route,
  months: number[],
  config: AppConfig,
  today: Date,
): Promise<CachedFare[]> {
  const searchDate = today.toISOString();
  const all: CachedFare[] = [];
  for (const month of months) {
    let fares: CachedFare[] = [];
    try {
      fares = await searchRouteForMonth(route, month, config, today);
    } catch (err) {
      console.warn(`[search] falha ao buscar ${route.id} (mês ${month}):`, err);
      continue;
    }
    for (const fare of fares) persistFare(route, fare, searchDate);
    all.push(...fares);
  }
  return all;
}
