import { defineConfig } from 'prisma/config';
import { databaseUrl } from './src/config/database-url';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only src/import/import.cli.ts ../data/products.csv',
  },
  datasource: {
    url: databaseUrl(),
  },
});
