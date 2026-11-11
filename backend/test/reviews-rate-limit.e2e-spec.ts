import { NestExpressApplication } from '@nestjs/platform-express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { ImportService } from '../src/import/import.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './support/test-database';
import { createTestApp } from './support/test-app';

const review = {
  authorName: 'Rate Tester',
  rating: 5,
  body: 'Submitting reviews in quick succession.',
};

describe('Review rate limiting (e2e)', () => {
  let app: NestExpressApplication;
  const previousLimit = process.env.REVIEW_RATE_LIMIT;

  beforeAll(async () => {
    process.env.REVIEW_RATE_LIMIT = '2';
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    const csv = readFileSync(
      join(__dirname, '../../data/products.csv'),
      'utf8',
    );
    await new ImportService(prisma).importContent(csv, 'products.csv');
  });

  afterAll(async () => {
    process.env.REVIEW_RATE_LIMIT = previousLimit;
    await app.close();
  });

  it('allows the configured number of reviews per window, then answers 429', async () => {
    const send = () =>
      request(app.getHttpServer())
        .post('/api/products/P-10002/reviews')
        .send(review);
    await send().expect(201);
    await send().expect(201);
    await send().expect(429);
  });

  it('limits the client IP forwarded by the proxy, not the proxy itself', async () => {
    const send = (ip: string) =>
      request(app.getHttpServer())
        .post('/api/products/P-10004/reviews')
        .set('X-Forwarded-For', ip)
        .send(review);
    await send('10.1.1.1').expect(201);
    await send('10.1.1.1').expect(201);
    await send('10.1.1.1').expect(429);
    await send('10.2.2.2').expect(201);
  });

  it('never limits reading', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .get('/api/products/P-10002/reviews')
        .expect(200);
    }
  });
});
