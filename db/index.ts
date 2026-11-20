import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as authSchema from './auth-schema';

const DEFAULT_DB_URL = 'postgresql://postgres:postgres@localhost:5432/bani_sukar';
const connectionString = process.env.DATABASE_URL || DEFAULT_DB_URL;

const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
};

export const client =
  globalForDb.postgresClient ??
  postgres(connectionString, {
    max: 10,
    prepare: false,
    connect_timeout: 3,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.postgresClient = client;
}

export const db = drizzle(client, {
  schema: {
    ...schema,
    ...authSchema,
  },
});

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export async function isDbAvailable(): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
