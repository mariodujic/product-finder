import { PrismaPg } from '@prisma/adapter-pg';
import { databaseUrl } from '../../src/config/database-url';
import { PrismaClient } from '../../src/generated/prisma/client';

/**
 * E2E tests run against a separate database (`<dev db>_test` by default) so
 * they never wipe development data. Override with DATABASE_URL_TEST.
 */
export function testDatabaseUrl(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const url = new URL(databaseUrl());
  url.pathname = `${url.pathname.replace(/^\//, '')}_test`;
  return url.toString();
}

export function createTestClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl() }),
  });
}

/** Empties every table. Keeps the schema, resets ids. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "reviews", "products", "import_runs" RESTART IDENTITY CASCADE',
  );
}
