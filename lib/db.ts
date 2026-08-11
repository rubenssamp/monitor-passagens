import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface SearchRow {
  id: number;
  route_id: string;
  search_date: string;
  departure_date: string;
  return_date: string;
  price: number;
  currency: string;
  airline: string | null;
  stops: number | null;
  raw_response: string | null;
  is_alert: number;
  created_at: string;
}

export interface NewSearchRow {
  route_id: string;
  search_date: string;
  departure_date: string;
  return_date: string;
  price: number;
  currency: string;
  airline?: string | null;
  stops?: number | null;
  raw_response?: string | null;
  is_alert?: boolean;
}

const DB_PATH = path.join(process.cwd(), "data", "prices.db");

let writeDb: DatabaseSync | null = null;
let readDb: DatabaseSync | null = null;

// node:sqlite retorna linhas com um protótipo não-plano, que o Next.js recusa serializar
// ao passar de Server Component pra Client Component. Normaliza pra objeto plano.
function toPlainRow<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

function toPlainRows<T>(rows: unknown[]): T[] {
  return rows.map((r) => toPlainRow<T>(r));
}

// Usada apenas pelo job (scripts/run-search.ts): abre em leitura/escrita e garante o schema.
// Usa o módulo nativo node:sqlite (Node >= 22.5) em vez de better-sqlite3: evita compilação
// nativa via node-gyp, que quebra em paths com espaço (ex: "Monitor Passagens").
export function getDb(): DatabaseSync {
  if (writeDb) return writeDb;
  writeDb = new DatabaseSync(DB_PATH);
  // Modo padrão (rollback journal), não WAL: cada commit grava direto no arquivo principal,
  // sem deixar dados pendentes em -wal/-shm — importante porque o workflow do GitHub Actions
  // só comita data/prices.db.
  writeDb.exec(`
    CREATE TABLE IF NOT EXISTS searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id TEXT NOT NULL,
      search_date TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      return_date TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL,
      airline TEXT,
      stops INTEGER,
      raw_response TEXT,
      is_alert INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_searches_route ON searches(route_id, departure_date);
  `);
  return writeDb;
}

export function closeDb(): void {
  if (writeDb) {
    writeDb.close();
    writeDb = null;
  }
}

// Usada pelo dashboard (lido em build time, já que o site é exportado estático pro GitHub
// Pages): abre em modo somente-leitura, garantindo que o build nunca escreve em prices.db —
// quem escreve é sempre o job (scripts/run-search.ts). Se o arquivo ainda não existe (antes do
// primeiro job rodar), retorna null em vez de lançar erro.
function getReadDb(): DatabaseSync | null {
  if (readDb) return readDb;
  // Não cacheia falha: se o arquivo ainda não existia na primeira tentativa, tenta de novo
  // na próxima chamada (o job pode criá-lo entre uma requisição e outra).
  try {
    readDb = new DatabaseSync(DB_PATH, { readOnly: true });
  } catch {
    return null;
  }
  return readDb;
}

export function insertSearch(row: NewSearchRow): void {
  const stmt = getDb().prepare(`
    INSERT INTO searches (route_id, search_date, departure_date, return_date, price, currency, airline, stops, raw_response, is_alert)
    VALUES ($route_id, $search_date, $departure_date, $return_date, $price, $currency, $airline, $stops, $raw_response, $is_alert)
  `);
  stmt.run({
    $route_id: row.route_id,
    $search_date: row.search_date,
    $departure_date: row.departure_date,
    $return_date: row.return_date,
    $price: row.price,
    $currency: row.currency,
    $airline: row.airline ?? null,
    $stops: row.stops ?? null,
    $raw_response: row.raw_response ?? null,
    $is_alert: row.is_alert ? 1 : 0,
  });
}

export function getCheapestPerRoute(): Record<string, SearchRow | undefined> {
  const conn = getReadDb();
  if (!conn) return {};
  const rows = conn
    .prepare(
      `SELECT s.* FROM searches s
       INNER JOIN (
         SELECT route_id, MIN(price) AS min_price FROM searches GROUP BY route_id
       ) m ON s.route_id = m.route_id AND s.price = m.min_price
       GROUP BY s.route_id`,
    )
    .all();
  const byRoute: Record<string, SearchRow> = {};
  for (const row of toPlainRows<SearchRow>(rows)) byRoute[row.route_id] = row;
  return byRoute;
}

export function getHistoryForRoute(routeId: string): SearchRow[] {
  const conn = getReadDb();
  if (!conn) return [];
  const rows = conn
    .prepare(`SELECT * FROM searches WHERE route_id = $route_id ORDER BY search_date ASC`)
    .all({ $route_id: routeId });
  return toPlainRows<SearchRow>(rows);
}

export function getAveragePriceForRoute(routeId: string): number | null {
  const conn = getReadDb();
  if (!conn) return null;
  const row = conn
    .prepare(`SELECT AVG(price) AS avg_price FROM searches WHERE route_id = $route_id`)
    .get({ $route_id: routeId }) as { avg_price: number | null } | undefined;
  return row?.avg_price ?? null;
}

export function getAllAlerts(): SearchRow[] {
  const conn = getReadDb();
  if (!conn) return [];
  const rows = conn
    .prepare(`SELECT * FROM searches WHERE is_alert = 1 ORDER BY search_date DESC`)
    .all();
  return toPlainRows<SearchRow>(rows);
}
