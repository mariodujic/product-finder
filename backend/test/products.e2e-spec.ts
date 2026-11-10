import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { Product } from '../src/generated/prisma/client';
import { ProductStatus } from '../src/generated/prisma/enums';
import { ImportService } from '../src/import/import.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ProductDetail,
  ProductSearchResult,
} from '../src/products/product.types';
import { resetDatabase } from './support/test-database';
import { createTestApp } from './support/test-app';

/**
 * Runs the API against the real sample export. Expected numbers come from an
 * independent oracle (plain JS filtering over all rows), not from hand-counted
 * constants, so the tests stay valid if the sample data changes.
 */
describe('Products API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let all: Product[];

  const search = async (query: string) => {
    const res = await request(app.getHttpServer())
      .get(`/api/products${query}`)
      .expect(200);
    return res.body as ProductSearchResult;
  };
  const searchable = (p: Product) =>
    p.isListed && p.status !== ProductStatus.DISCONTINUED;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    const csv = readFileSync(
      join(__dirname, '../../data/products.csv'),
      'utf8',
    );
    await new ImportService(prisma).importContent(csv, 'products.csv');
    // One delisted product: gone from the export, but its page must still work.
    await prisma.product.update({
      where: { sku: 'P-10001' },
      data: { isListed: false },
    });
    all = await prisma.product.findMany();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/products', () => {
    it('lists searchable products by name with default paging and facets', async () => {
      const body = await search('');

      expect(body.total).toBe(all.filter(searchable).length);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(20);
      expect(body.items).toHaveLength(20);
      const names = body.items.map((p) => p.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      const { launchYear, ...rest } = body.items[0];
      expect(rest).toEqual({
        sku: expect.any(String),
        name: expect.any(String),
        chemicalName: expect.any(String),
        function: expect.any(String),
        applicationArea: expect.any(String),
        region: expect.any(String),
        certifications: expect.any(Array),
        status: expect.any(String),
        rating: { average: null, count: 0 },
      });
      expect(launchYear === null || typeof launchYear === 'number').toBe(true);
    });

    it('hides discontinued products unless requested, and never shows delisted ones', async () => {
      const hidden = await search('?pageSize=100');
      expect(hidden.items.map((p) => p.status)).not.toContain(
        ProductStatus.DISCONTINUED,
      );

      const shown = await search('?includeDiscontinued=true');
      expect(shown.total).toBe(all.filter((p) => p.isListed).length);

      const delisted = await search('?q=P-10001&includeDiscontinued=true');
      expect(delisted.total).toBe(0);
    });

    it('pages through results without gaps or overlap', async () => {
      const first = await search('?pageSize=7&page=1');
      const second = await search('?pageSize=7&page=2');
      const both = await search('?pageSize=14&page=1');
      expect([...first.items, ...second.items]).toEqual(both.items);
    });

    it('searches partially and case-insensitively across name, chemical name and SKU', async () => {
      const body = await search('?q=LAURET&pageSize=100');
      const expected = all.filter(
        (p) =>
          searchable(p) &&
          /lauret/i.test(p.name + p.chemicalName + p.sku + p.description),
      );
      expect(body.total).toBe(expected.length);
      expect(body.total).toBeGreaterThan(0);

      const bySku = await search('?q=p-10002');
      expect(bySku.items.map((p) => p.sku)).toEqual(['P-10002']);
    });

    it('requires every search term to match', async () => {
      const body = await search('?q=surfactant%20home&pageSize=100');
      const text = (p: Product) =>
        `${p.name} ${p.chemicalName} ${p.sku} ${p.description}`.toLowerCase();
      const expected = all.filter(
        (p) =>
          searchable(p) &&
          text(p).includes('surfactant') &&
          text(p).includes('home'),
      );
      expect(body.total).toBe(expected.length);
    });

    it('includes Global products when filtering by a region', async () => {
      const body = await search('?region=EMEA&pageSize=100');
      const regions = new Set(body.items.map((p) => p.region));
      expect([...regions].sort()).toEqual(['EMEA', 'Global']);
      expect(body.total).toBe(
        all.filter(
          (p) => searchable(p) && ['EMEA', 'Global'].includes(p.region),
        ).length,
      );
    });

    it('ORs values within a filter and ANDs across filters', async () => {
      const body = await search(
        '?function=Surfactant&function=Emulsifier&applicationArea=Personal%20Care&pageSize=100',
      );
      const expected = all.filter(
        (p) =>
          searchable(p) &&
          ['Surfactant', 'Emulsifier'].includes(p.function) &&
          p.applicationArea === 'Personal Care',
      );
      expect(body.total).toBe(expected.length);
      expect(body.total).toBeGreaterThan(0);
    });

    it('requires all selected certifications', async () => {
      const body = await search(
        '?certifications=Vegan&certifications=Kosher&pageSize=100',
      );
      const expected = all.filter(
        (p) =>
          searchable(p) &&
          p.certifications.includes('Vegan') &&
          p.certifications.includes('Kosher'),
      );
      expect(body.total).toBe(expected.length);
      for (const item of body.items) {
        expect(item.certifications).toEqual(
          expect.arrayContaining(['Vegan', 'Kosher']),
        );
      }
    });

    it('returns facet counts that ignore their own selection', async () => {
      const body = await search('?region=EMEA');

      // The region facet still offers every region, counted without the region filter.
      expect(body.facets.region.map((f) => f.value)).toEqual([
        'Asia Pacific',
        'EMEA',
        'Global',
        'Latin America',
        'North America',
      ]);
      const emea = body.facets.region.find((f) => f.value === 'EMEA');
      expect(emea?.count).toBe(
        all.filter((p) => searchable(p) && p.region === 'EMEA').length,
      );

      // Other facets are narrowed by the region filter and add up to the total.
      const functionSum = body.facets.function.reduce(
        (sum, f) => sum + f.count,
        0,
      );
      expect(functionSum).toBe(body.total);
      expect(body.facets.certifications.map((f) => f.value)).toContain('Vegan');
    });

    it('sorts by launch year with unknown years last', async () => {
      const body = await search(
        '?sort=-launchYear&pageSize=100&includeDiscontinued=true&page=2',
      );
      const years = body.items.map((p) => p.launchYear);
      const known = years.filter((y): y is number => y !== null);
      expect(known).toEqual([...known].sort((a, b) => b - a));
      expect(years.slice(years.indexOf(null))).toEqual(
        years.filter((y) => y === null),
      );
    });

    it.each([
      ['an unknown parameter', '?regoin=EMEA'],
      ['an unknown sort', '?sort=price'],
      ['page 0', '?page=0'],
      ['an oversized page', '?pageSize=101'],
      ['a non-boolean flag', '?includeDiscontinued=yes'],
      ['an oversized search', `?q=${'x'.repeat(101)}`],
    ])('rejects %s with 400', async (_, query) => {
      await request(app.getHttpServer())
        .get(`/api/products${query}`)
        .expect(400);
    });
  });

  describe('GET /api/products/:sku', () => {
    it('returns the full product, case-insensitively', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products/p-10003')
        .expect(200);
      const body = res.body as ProductDetail;
      expect(body).toMatchObject({
        sku: 'P-10003',
        name: 'Velumin EF 650',
        status: ProductStatus.PHASE_OUT,
        isListed: true,
        certifications: [
          'Kosher',
          'Readily Biodegradable',
          'RSPO Mass Balance',
        ],
      });
      expect(body.description).toContain('Mono- and Diglycerides');
    });

    it('still serves delisted and discontinued products so shared links keep working', async () => {
      const delisted = await request(app.getHttpServer())
        .get('/api/products/P-10001')
        .expect(200);
      expect((delisted.body as ProductDetail).isListed).toBe(false);

      const discontinued = await request(app.getHttpServer())
        .get('/api/products/P-10007')
        .expect(200);
      expect((discontinued.body as ProductDetail).status).toBe(
        ProductStatus.DISCONTINUED,
      );
    });

    it('returns 404 for an unknown SKU', async () => {
      await request(app.getHttpServer())
        .get('/api/products/P-99999')
        .expect(404);
    });
  });
});
