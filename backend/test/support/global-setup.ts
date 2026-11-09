import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { PrismaClient } from '../../src/generated/prisma/client';
import { testDatabaseUrl } from './test-database';

/** Creates the test database if needed and brings it to the latest migration. */
export default async function globalSetup(): Promise<void> {
  const url = new URL(testDatabaseUrl());
  const dbName = decodeURIComponent(url.pathname.slice(1));
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminUrl.toString() }),
  });
  try {
    const rows = await admin.$queryRaw<unknown[]>`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (rows.length === 0) {
      await admin.$executeRawUnsafe(
        `CREATE DATABASE "${dbName.replace(/"/g, '""')}"`,
      );
    }
  } catch (err) {
    throw new Error(
      `Cannot reach PostgreSQL for e2e tests (${(err as Error).message}). ` +
        'Start it with: docker compose up -d db',
    );
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'ignore',
  });
}
