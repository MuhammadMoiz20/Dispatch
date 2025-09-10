import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPg() {
  if (!pool) {
    const url =
      process.env.DATABASE_URL || 'postgresql://dispatch:dispatch@localhost:5432/dispatch';
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }> {
  const p = getPg();
  const res = await p.query(sql, params);
  return { rows: res.rows as unknown as T[] };
}
