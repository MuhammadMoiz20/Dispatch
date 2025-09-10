import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPg(): Pool {
  if (!pool) {
    const url =
      process.env.DATABASE_URL || 'postgresql://dispatch:dispatch@localhost:5432/dispatch';
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export async function pgQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const p = getPg();
  const res = await p.query(sql, params);
  return res.rows as unknown as T[];
}
