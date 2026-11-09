import { testDatabaseUrl } from './test-database';

// Every PrismaService created inside an e2e test talks to the test database.
process.env.DATABASE_URL = testDatabaseUrl();
