import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { z } from 'zod';

export async function migrate(connectionString) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    // Serialize concurrent migration runners, including creation of the ledger.
    await client.query('SELECT pg_advisory_xact_lock(188524, 1)');
    await client.query(`CREATE TABLE IF NOT EXISTS public.newsapi_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const directory = new URL('../migrations/', import.meta.url);
    const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
    const applied = [];
    for (const name of files) {
      const source = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const existing = await client.query('SELECT checksum FROM public.newsapi_migrations WHERE name = $1', [name]);
      if (existing.rows.length > 0) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration has changed: ${name}`);
        }
        continue;
      }
      await client.query(source);
      await client.query('INSERT INTO public.newsapi_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
      applied.push(name);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const connectionString = z.string().url().parse(process.env.DB_URL);
  // Do not print connection strings or database errors that may contain secrets.
  migrate(connectionString).then(
    (applied) => console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`),
    () => { console.error('Migration failed. Check database access and migration compatibility.'); process.exitCode = 1; },
  );
}
