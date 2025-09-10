import { createClient, ClickHouseClient, ClickHouseClientConfigOptions } from '@clickhouse/client';

let client: ClickHouseClient | null = null;

export function getClickHouse(): ClickHouseClient {
  if (!client) {
    const url = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
    const username = process.env.CLICKHOUSE_USER || 'default';
    const password = process.env.CLICKHOUSE_PASSWORD || '';
    const cfg: ClickHouseClientConfigOptions = {
      host: url,
      username,
      password,
    };
    client = createClient(cfg);
  }
  return client;
}

export async function insertEvents(rows: Record<string, any>[]) {
  const ch = getClickHouse();
  if (!rows.length) return;
  await ch.insert({
    table: 'analytics.events_raw',
    values: rows,
    format: 'JSONEachRow',
  });
}

export async function query<T = any>(q: string, params?: Record<string, any>): Promise<T[]> {
  const ch = getClickHouse();
  const rsp = await ch.query({ query: q, format: 'JSONEachRow', query_params: params });
  const data = await rsp.json<T>();
  return data;
}
