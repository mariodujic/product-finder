import { existsSync } from 'node:fs';

/** Default for local development only (matches docker-compose.yml). */
const LOCAL_DEV_URL =
  'postgresql://productfinder:productfinder@localhost:5432/productfinder';

/**
 * Resolves the PostgreSQL connection string.
 * Loads `.env` if present (Node built-in, no dotenv dependency). Outside
 * production it falls back to the local docker-compose database so that
 * `npm run dev` works with zero configuration. In production a missing
 * DATABASE_URL is a hard error, never a silent fallback.
 */
export function databaseUrl(): string {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL must be set in production');
  }
  return LOCAL_DEV_URL;
}
