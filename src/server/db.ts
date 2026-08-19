import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * The local container's throwaway credentials stand in during development only.
 * In production a missing DATABASE_URL is a deployment fault: fail loudly rather
 * than quietly dialling a database that is not there.
 */
function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is not set.');
  }
  return 'postgres://inventory:inventory@127.0.0.1:15433/inventory';
}

/**
 * Next reloads modules on every edit in development, which would open a new pool
 * each time. Caching it on globalThis keeps a single pool per process.
 */
const globalForDb = globalThis as unknown as {
  __inventoryPool?: Pool;
  __inventoryDb?: NodePgDatabase<typeof schema>;
};

/**
 * Hosted Postgres (Neon, Supabase, RDS) requires TLS; a local container does not
 * and has no certificate to present. Decided from the host rather than from an
 * environment flag, so moving between them needs no extra configuration.
 */
function isLocal(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

/**
 * Built on first query, never at import time: the build worker loads these
 * modules while prerendering pages and must not open a client to do it.
 */
function connect(): NodePgDatabase<typeof schema> {
  if (globalForDb.__inventoryDb) return globalForDb.__inventoryDb;

  const url = connectionString();
  const pool = new Pool({
    connectionString: url,
    ssl: isLocal(url) ? undefined : { rejectUnauthorized: true },
    // Neon closes idle connections at its own pace and bills by compute time, so a
    // serverless-friendly pool stays small and lets connections go sooner.
    max: isLocal(url) ? 10 : 5,
    idleTimeoutMillis: isLocal(url) ? 30_000 : 10_000,
    connectionTimeoutMillis: 15_000,
  });
  const instance = drizzle(pool, { schema });
  globalForDb.__inventoryPool = pool;
  globalForDb.__inventoryDb = instance;
  return instance;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    const real = connect();
    const value = Reflect.get(real, prop) as unknown;
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

/** Closes the pool — for one-shot scripts, not for the server. */
export async function closePool(): Promise<void> {
  await globalForDb.__inventoryPool?.end();
  globalForDb.__inventoryPool = undefined;
  globalForDb.__inventoryDb = undefined;
}

export { schema };
