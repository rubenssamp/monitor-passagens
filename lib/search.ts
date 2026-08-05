import { AppConfig, Route } from "./config";
import { confirmFlightOffer, searchCheapestDates, CheapestDateResult } from "./amadeus";
import { getDb, insertSearch, NewSearchRow } from "./db";

const TOP_N_DATES = 3;
const FALLBACK_MAX_CALLS_PER_MONTH = 10;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Range de datas de ida a varrer para um mês permitido: a próxima ocorrência desse mês
 * (este ano ou o próximo, o que vier primeiro no futuro), recortada por hoje e pelo horizonte
 * de busca configurado.
 */
export function monthDateRange(
  month: number,
  config: AppConfig,
  today: Date,
): { from: string; to: string } | null {
  const horizonEnd = addDays(today, config.search_horizon_days);

  let year = today.getUTCFullYear();
  let monthStart = new Date(Date.UTC(year, month - 1, 1));
  let monthEnd = new Date(Date.UTC(year, month, 0));
  if (monthEnd < today) {
    year += 1;
    monthStart = new Date(Date.UTC(year, month - 1, 1));
    monthEnd = new Date(Date.UTC(year, month, 0));
  }

  const from = monthStart < today ? today : monthStart;
  const to = monthEnd > horizonEnd ? horizonEnd : monthEnd;

  if (from > to) return null;
  return { from: formatDate(from), to: formatDate(to) };
}

interface ConfirmedResult {
  route: Route;
  departureDate: string;
  returnDate: string;
  price: number;
  currency: string;
  airline: string | null;
  stops: number | null;
  raw: unknown;
}

/**
 * Fallback quando o Cheapest Date Search não cobre a rota (ex: sem suporte a conexões).
 * Faz loop de Flight Offers Search direto, mas limita o número de chamadas por mês pra não
 * estourar o orçamento — amostra datas espaçadas dentro do range em vez de varrer dia a dia.
 */
async function searchByLoopingOffers(
  route: Route,
  from: string,
  to: string,
  tripDurationDays: number,
): Promise<CheapestDateResult[]> {
  const fromDate = new Date(from + "T00:00:00Z");
  const toDate = new Date(to + "T00:00:00Z");
  const totalDays = Math.max(
    1,
    Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const step = Math.max(1, Math.ceil(totalDays / FALLBACK_MAX_CALLS_PER_MONTH));

  const results: CheapestDateResult[] = [];
  for (let offset = 0; offset <= totalDays; offset += step) {
    const departureDate = formatDate(addDays(fromDate, offset));
    const returnDate = formatDate(addDays(fromDate, offset + tripDurationDays));
    try {
      const offer = await confirmFlightOffer({
        origin: route.origin,
        destination: route.destination,
        departureDate,
        returnDate,
        currencyCode: route.currency,
      });
      if (offer) {
        results.push({
          departureDate,
          returnDate,
          price: offer.price,
          currency: offer.currency,
        });
      }
    } catch (err) {
      console.warn(`[fallback] falha ao confirmar ${route.id} em ${departureDate}:`, err);
    }
  }
  return results;
}

async function searchRouteForMonth(
  route: Route,
  month: number,
  config: AppConfig,
  today: Date,
): Promise<ConfirmedResult[]> {
  const range = monthDateRange(month, config, today);
  if (!range) return [];

  let candidates: CheapestDateResult[] = [];
  try {
    candidates = await searchCheapestDates({
      origin: route.origin,
      destination: route.destination,
      departureDateFrom: range.from,
      departureDateTo: range.to,
      durationDays: config.trip_duration_days,
    });
  } catch (err) {
    console.warn(`[cheapest-date] falhou para ${route.id} (mês ${month}), usando fallback:`, err);
  }

  if (candidates.length === 0) {
    candidates = await searchByLoopingOffers(route, range.from, range.to, config.trip_duration_days);
  }

  const top = [...candidates].sort((a, b) => a.price - b.price).slice(0, TOP_N_DATES);

  const confirmed: ConfirmedResult[] = [];
  for (const candidate of top) {
    const returnDate =
      candidate.returnDate ??
      formatDate(addDays(new Date(candidate.departureDate + "T00:00:00Z"), config.trip_duration_days));
    try {
      const offer = await confirmFlightOffer({
        origin: route.origin,
        destination: route.destination,
        departureDate: candidate.departureDate,
        returnDate,
        currencyCode: route.currency,
      });
      if (offer) {
        confirmed.push({
          route,
          departureDate: candidate.departureDate,
          returnDate,
          price: offer.price,
          currency: offer.currency,
          airline: offer.airline,
          stops: offer.stops,
          raw: offer.raw,
        });
      }
    } catch (err) {
      console.warn(`[confirm] falha ao confirmar ${route.id} em ${candidate.departureDate}:`, err);
    }
  }
  return confirmed;
}

function persistResult(result: ConfirmedResult, searchDate: string): void {
  const isAlert = result.price < result.route.price_threshold;
  const row: NewSearchRow = {
    route_id: result.route.id,
    search_date: searchDate,
    departure_date: result.departureDate,
    return_date: result.returnDate,
    price: result.price,
    currency: result.currency,
    airline: result.airline,
    stops: result.stops,
    raw_response: JSON.stringify(result.raw),
    is_alert: isAlert,
  };
  insertSearch(row);
}

export async function searchRouteForMonths(
  route: Route,
  months: number[],
  config: AppConfig,
  today: Date,
): Promise<ConfirmedResult[]> {
  const searchDate = today.toISOString();
  const all: ConfirmedResult[] = [];
  for (const month of months) {
    const confirmed = await searchRouteForMonth(route, month, config, today);
    for (const result of confirmed) persistResult(result, searchDate);
    all.push(...confirmed);
  }
  return all;
}

/** Execução da noite: reconfirma via Flight Offers o menor preço já achado hoje para a rota. */
export async function reconfirmBestOfDay(route: Route, today: Date): Promise<void> {
  const todayStr = formatDate(today);
  const best = getDb()
    .prepare(
      `SELECT * FROM searches WHERE route_id = ? AND search_date LIKE ? ORDER BY price ASC LIMIT 1`,
    )
    .get(route.id, `${todayStr}%`) as
    | { departure_date: string; return_date: string; price: number }
    | undefined;

  if (!best) return;

  try {
    const offer = await confirmFlightOffer({
      origin: route.origin,
      destination: route.destination,
      departureDate: best.departure_date,
      returnDate: best.return_date,
      currencyCode: route.currency,
    });
    if (offer) {
      persistResult(
        {
          route,
          departureDate: best.departure_date,
          returnDate: best.return_date,
          price: offer.price,
          currency: offer.currency,
          airline: offer.airline,
          stops: offer.stops,
          raw: offer.raw,
        },
        today.toISOString(),
      );
    }
  } catch (err) {
    console.warn(`[reconfirm] falha ao reconfirmar ${route.id}:`, err);
  }
}
