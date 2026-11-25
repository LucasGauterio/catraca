import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const DEFAULT_DATABASE_URL = 'postgres://catraca:catraca@localhost:54329/catraca';

const globalForDb = globalThis as unknown as {
  catracaPgPool?: Pool;
  catracaDb?: NodePgDatabase<typeof schema>;
};

/**
 * Returns the singleton PostgreSQL connection pool.
 */
export function getPool(): Pool {
  if (!globalForDb.catracaPgPool) {
    globalForDb.catracaPgPool = new Pool({
      connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
      max: 20,
    });
  }
  return globalForDb.catracaPgPool;
}

/**
 * Returns the singleton Drizzle ORM database instance configured with the Catraca schema.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.catracaDb) {
    globalForDb.catracaDb = drizzle(getPool(), { schema });
  }
  return globalForDb.catracaDb;
}

export const db = getDb();
export const pool = getPool();
