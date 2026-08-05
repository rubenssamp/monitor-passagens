const BASE_URL = process.env.AMADEUS_BASE_URL ?? "https://test.api.amadeus.com";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5_000) {
    return cachedToken.value;
  }

  const clientId = process.env.AMADEUS_API_KEY;
  const clientSecret = process.env.AMADEUS_API_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("AMADEUS_API_KEY / AMADEUS_API_SECRET não configurados");
  }

  const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Amadeus OAuth falhou: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

async function amadeusGet<T>(pathAndQuery: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Amadeus GET ${pathAndQuery} falhou: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export interface CheapestDateResult {
  departureDate: string;
  returnDate: string | null;
  price: number;
  currency: string;
}

interface FlightDatesResponse {
  data?: Array<{
    departureDate: string;
    returnDate?: string;
    price: { total: string };
  }>;
  meta?: { currency?: string };
  errors?: Array<{ title: string; detail?: string }>;
}

/**
 * Cheapest Date Search — varre um range de datas de ida num mês e retorna o preço mais
 * barato por data. Cobertura de rotas com conexão e do parâmetro `duration` não é garantida
 * pela Amadeus; ver spike de validação antes de depender disso em produção (PRD seção 3).
 */
export async function searchCheapestDates(params: {
  origin: string;
  destination: string;
  departureDateFrom: string; // YYYY-MM-DD
  departureDateTo: string; // YYYY-MM-DD
  durationDays: number;
}): Promise<CheapestDateResult[]> {
  const query = new URLSearchParams({
    origin: params.origin,
    destination: params.destination,
    departureDate: `${params.departureDateFrom},${params.departureDateTo}`,
    duration: String(params.durationDays),
    oneWay: "false",
    viewBy: "DATE",
  });

  const json = await amadeusGet<FlightDatesResponse>(
    `/v1/shopping/flight-dates?${query.toString()}`,
  );

  if (!json.data) return [];

  const currency = json.meta?.currency ?? "EUR";
  return json.data.map((d) => ({
    departureDate: d.departureDate,
    returnDate: d.returnDate ?? null,
    price: parseFloat(d.price.total),
    currency,
  }));
}

export interface FlightOfferResult {
  price: number;
  currency: string;
  airline: string | null;
  stops: number | null;
  raw: unknown;
}

interface FlightOffersResponse {
  data?: Array<{
    price: { total: string; currency: string };
    validatingAirlineCodes?: string[];
    itineraries: Array<{ segments: Array<unknown> }>;
  }>;
  errors?: Array<{ title: string; detail?: string }>;
}

/** Flight Offers Search — confirma preço real para um par ida/volta específico. */
export async function confirmFlightOffer(params: {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  currencyCode?: string;
}): Promise<FlightOfferResult | null> {
  const query = new URLSearchParams({
    originLocationCode: params.origin,
    destinationLocationCode: params.destination,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
    adults: "1",
    currencyCode: params.currencyCode ?? "BRL",
    max: "5",
  });

  const json = await amadeusGet<FlightOffersResponse>(
    `/v2/shopping/flight-offers?${query.toString()}`,
  );

  if (!json.data || json.data.length === 0) return null;

  const cheapest = json.data.reduce((min, offer) =>
    parseFloat(offer.price.total) < parseFloat(min.price.total) ? offer : min,
  );

  const outboundSegments = cheapest.itineraries[0]?.segments.length ?? 1;

  return {
    price: parseFloat(cheapest.price.total),
    currency: cheapest.price.currency,
    airline: cheapest.validatingAirlineCodes?.[0] ?? null,
    stops: Math.max(0, outboundSegments - 1),
    raw: cheapest,
  };
}
