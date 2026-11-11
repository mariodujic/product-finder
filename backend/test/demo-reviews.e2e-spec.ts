import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImportService } from '../src/import/import.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DEMO_REVIEWS, seedDemoReviews } from '../src/reviews/demo-reviews';
import { resetDatabase } from './support/test-database';

describe('Demo review seed (against PostgreSQL)', () => {
  let prisma: PrismaService;
  const csv = readFileSync(join(__dirname, '../../data/products.csv'), 'utf8');

  beforeAll(() => {
    prisma = new PrismaService();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    await new ImportService(prisma).importContent(csv, 'products.csv');
  });
  afterAll(() => prisma.$disconnect());

  it('inserts the demo reviews once and keeps rating aggregates in sync', async () => {
    const first = await seedDemoReviews(prisma);
    expect(first).toEqual({
      inserted: DEMO_REVIEWS.length,
      existing: 0,
      missingProducts: [],
    });

    const p = await prisma.product.findUniqueOrThrow({
      where: { sku: 'P-10001' },
    });
    expect(p.reviewCount).toBe(2);
    expect(Number(p.ratingAvg)).toBe(4.5);
  });

  it('is idempotent and leaves real reviews alone', async () => {
    await seedDemoReviews(prisma);
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'P-10001' },
    });
    await prisma.review.create({
      data: {
        productId: product.id,
        authorName: 'Real customer',
        rating: 1,
        body: 'Did not work for us.',
      },
    });

    const second = await seedDemoReviews(prisma);

    expect(second).toEqual({
      inserted: 0,
      existing: DEMO_REVIEWS.length,
      missingProducts: [],
    });
    expect(await prisma.review.count()).toBe(DEMO_REVIEWS.length + 1);
  });

  it('survives a product re-import', async () => {
    await seedDemoReviews(prisma);
    await new ImportService(prisma).importContent(csv, 'products.csv');
    expect(await prisma.review.count()).toBe(DEMO_REVIEWS.length);
  });

  it('reports demo reviews whose product does not exist', async () => {
    const result = await seedDemoReviews(prisma, [
      {
        sku: 'P-00000',
        authorName: 'Nobody (demo)',
        rating: 3,
        body: 'Missing product.',
      },
    ]);
    expect(result.missingProducts).toEqual(['P-00000']);
  });
});
