import { testDatabaseUrl } from './test-database';

// Every PrismaService created inside an e2e test talks to the test database.
process.env.DATABASE_URL = testDatabaseUrl();
// Most suites post many reviews; the rate limit has its own dedicated suite.
process.env.REVIEW_RATE_LIMIT ??= '1000';
