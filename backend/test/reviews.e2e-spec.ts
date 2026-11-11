import { NestExpressApplication } from '@nestjs/platform-express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { ImportService } from '../src/import/import.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductDetail } from '../src/products/product.types';
import { ReviewPage, ReviewView } from '../src/reviews/review.types';
import { resetDatabase } from './support/test-database';
import { createTestApp } from './support/test-app';

const valid = {
  authorName: 'Ana K.',
  rating: 4,
  title: 'Stable in our shampoo base',
  body: 'Easy to process and the viscosity stayed stable over 3 months.',
};

describe('Reviews API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const post = (sku: string, body: object) =>
    request(app.getHttpServer())
      .post(`/api/products/${sku}/reviews`)
      .send(body);
  const product = async (sku: string) =>
    (await request(app.getHttpServer()).get(`/api/products/${sku}`).expect(200))
      .body as ProductDetail;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    const csv = readFileSync(
      join(__dirname, '../../data/products.csv'),
      'utf8',
    );
    await new ImportService(prisma).importContent(csv, 'products.csv');
    await prisma.product.update({
      where: { sku: 'P-10011' },
      data: { isListed: false },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/products/:sku/reviews', () => {
    it('creates a review and updates the product rating', async () => {
      const res = await post('p-10002', valid).expect(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        ...valid,
        createdAt: expect.any(String),
      });
      expect((await product('P-10002')).rating).toEqual({
        average: 4,
        count: 1,
      });
    });

    it('keeps the average exact across several reviews', async () => {
      for (const rating of [5, 4, 4])
        await post('P-10004', { ...valid, rating }).expect(201);
      expect((await product('P-10004')).rating).toEqual({
        average: 4.33,
        count: 3,
      });
    });

    it('counts every review when many arrive at the same time', async () => {
      const ratings = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1];
      const results = await Promise.all(
        ratings.map((rating) => post('P-10005', { ...valid, rating })),
      );
      expect(results.map((r) => r.status)).toEqual(ratings.map(() => 201));
      expect((await product('P-10005')).rating).toEqual({
        average: 3,
        count: 10,
      });
    });

    it('trims input and treats an empty title as no title', async () => {
      const res = await post('P-10006', {
        ...valid,
        authorName: '  Marko  ',
        title: '   ',
      }).expect(201);
      expect(res.body).toMatchObject({ authorName: 'Marko', title: null });
    });

    it('stores markup as plain text, unchanged', async () => {
      const body = 'Works well. <script>alert(1)</script> <b>Recommended</b>';
      const res = await post('P-10006', { ...valid, body }).expect(201);
      expect((res.body as ReviewView).body).toBe(body);
    });

    it.each([
      ['rating 0', { rating: 0 }],
      ['rating 6', { rating: 6 }],
      ['a fractional rating', { rating: 3.5 }],
      ['a rating sent as text', { rating: '5' }],
      ['a missing author', { authorName: undefined }],
      ['a one-letter author', { authorName: 'A' }],
      ['a too-short body', { body: 'Great' }],
      ['a too-long body', { body: 'x'.repeat(2001) }],
      ['a too-long title', { title: 'x'.repeat(121) }],
      ['an unknown field', { verified: true }],
      ['a filled honeypot', { website: 'http://spam.example' }],
    ])('rejects %s with 400', async (_, overrides) => {
      await post('P-10002', { ...valid, ...overrides }).expect(400);
    });

    it('rejects reviews for discontinued products with 409', async () => {
      await post('P-10007', valid).expect(409);
    });

    it('rejects reviews for products no longer in the catalogue with 409', async () => {
      await post('P-10011', valid).expect(409);
    });

    it('returns 404 for an unknown product', async () => {
      await post('P-99999', valid).expect(404);
    });

    it('does not change the rating when a review is rejected', async () => {
      const before = (await product('P-10002')).rating;
      await post('P-10002', { ...valid, rating: 9 }).expect(400);
      expect((await product('P-10002')).rating).toEqual(before);
    });
  });

  describe('GET /api/products/:sku/reviews', () => {
    it('lists reviews newest first, paged', async () => {
      for (const authorName of ['First', 'Second', 'Third']) {
        await post('P-10010', { ...valid, authorName }).expect(201);
      }
      const res = await request(app.getHttpServer())
        .get('/api/products/P-10010/reviews?pageSize=2')
        .expect(200);
      const page = res.body as ReviewPage;
      expect(page.total).toBe(3);
      expect(page.items.map((r) => r.authorName)).toEqual(['Third', 'Second']);
    });

    it('still shows reviews of discontinued products', async () => {
      const discontinued = await prisma.product.findUniqueOrThrow({
        where: { sku: 'P-10007' },
      });
      await prisma.review.create({
        data: {
          productId: discontinued.id,
          authorName: 'Old customer',
          rating: 3,
          body: 'Used it for years.',
        },
      });
      const res = await request(app.getHttpServer())
        .get('/api/products/P-10007/reviews')
        .expect(200);
      expect((res.body as ReviewPage).total).toBe(1);
    });

    it('returns an empty page for a product without reviews', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products/P-10003/reviews')
        .expect(200);
      expect(res.body).toEqual({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('returns 404 for an unknown product and 400 for an oversized page', async () => {
      await request(app.getHttpServer())
        .get('/api/products/P-99999/reviews')
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/products/P-10002/reviews?pageSize=51')
        .expect(400);
    });
  });
});
