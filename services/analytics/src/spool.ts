import fs from 'fs';
import path from 'path';

const SPOOL_DIR = process.env.ETL_SPOOL_DIR || path.join(process.cwd(), 'spool');

export function ensureSpoolDir() {
  try {
    fs.mkdirSync(SPOOL_DIR, { recursive: true });
  } catch (err) {
    // Intentionally ignore failures creating spool dir (non-critical in tests)
  }
}

export function spoolPath() {
  return SPOOL_DIR;
}

export async function writeSpool(rows: Record<string, any>[]) {
  ensureSpoolDir();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`;
  const file = path.join(SPOOL_DIR, name);
  await fs.promises.writeFile(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

export async function readBatch(
  limitFiles = 5,
): Promise<{ file: string; rows: Record<string, any>[] }[]> {
  ensureSpoolDir();
  const files = (await fs.promises.readdir(SPOOL_DIR))
    .filter((f) => f.endsWith('.ndjson'))
    .slice(0, limitFiles);
  const batches: { file: string; rows: Record<string, any>[] }[] = [];
  for (const f of files) {
    const file = path.join(SPOOL_DIR, f);
    const content = await fs.promises.readFile(file, 'utf8');
    const rows = content
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    batches.push({ file, rows });
  }
  return batches;
}

export async function removeFile(file: string) {
  try {
    await fs.promises.unlink(file);
  } catch (err) {
    // Intentionally ignore failures removing spool files (may already be gone)
  }
}
