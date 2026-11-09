import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImportRunStatus, ProductStatus } from '../src/generated/prisma/enums';
import { ImportService } from '../src/import/import.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './support/test-database';

const HEADER =
  'sku,name,chemical_name,function,application_area,region,certifications,status,launch_year,description';
const SAMPLE = readFileSync(join(__dirname, '../../data/products.csv'), 'utf8');

/** Builds a small export: one row per SKU, overridable per row. */
function csv(
  rows: Array<{ sku: string; name?: string; status?: string }>,
): string {
  const lines = rows.map(
    (r) =>
      `${r.sku},${r.name ?? `Product ${r.sku}`},Chem,Polymer,Coatings,Global,Vegan,${r.status ?? 'Active'},2020,Desc`,
  );
  return [HEADER, ...lines].join('\n');
}
const skus = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ sku: `T-${i + 1}` }));

describe('Import (against PostgreSQL)', () => {
  let prisma: PrismaService;
  let importer: ImportService;

  beforeAll(() => {
    prisma = new PrismaService();
    importer = new ImportService(prisma);
  });
  beforeEach(() => resetDatabase(prisma));
  afterAll(() => prisma.$disconnect());

  const addReview = (sku: string) =>
    prisma.product.update({
      where: { sku },
      data: {
        reviews: { create: { authorName: 'Ana', rating: 5, body: 'Great' } },
      },
    });

  it('populates an empty database from the sample export', async () => {
    const summary = await importer.importContent(SAMPLE, 'products.csv');

    expect(summary).toMatchObject({
      status: ImportRunStatus.SUCCEEDED,
      inserted: 198,
      skipped: 3,
    });
    expect(await prisma.product.count()).toBe(198);
    const run = await prisma.importRun.findUniqueOrThrow({
      where: { id: summary.runId },
    });
    expect(run).toMatchObject({
      status: ImportRunStatus.SUCCEEDED,
      inserted: 198,
    });
    expect(run.finishedAt).not.toBeNull();
  });

  it('is idempotent: a second run changes nothing and creates no duplicates', async () => {
    await importer.importContent(SAMPLE, 'products.csv');
    const before = await prisma.product.findMany({ orderBy: { sku: 'asc' } });

    const second = await importer.importContent(SAMPLE, 'products.csv');

    expect(second).toMatchObject({
      inserted: 0,
      updated: 0,
      delisted: 0,
      unchanged: 198,
    });
    expect(await prisma.product.findMany({ orderBy: { sku: 'asc' } })).toEqual(
      before,
    );
  });

  it('keeps reviews when products are re-imported and updated', async () => {
    await importer.importContent(csv(skus(5)), 'v1');
    await addReview('T-1');
    const { id } = await prisma.product.findUniqueOrThrow({
      where: { sku: 'T-1' },
    });

    const summary = await importer.importContent(
      csv([
        { sku: 'T-1', name: 'Renamed', status: 'Discontinued' },
        ...skus(5).slice(1),
      ]),
      'v2',
    );

    expect(summary.updated).toBe(1);
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'T-1' },
      include: { reviews: true },
    });
    expect(product).toMatchObject({
      id,
      name: 'Renamed',
      status: ProductStatus.DISCONTINUED,
    });
    expect(product.reviews).toHaveLength(1);
  });

  it('delists (never deletes) a product missing from the export, and relists it when it returns', async () => {
    await importer.importContent(csv(skus(10)), 'v1');
    await addReview('T-10');

    const dropped = await importer.importContent(csv(skus(9)), 'v2');
    expect(dropped.delisted).toBe(1);
    const delisted = await prisma.product.findUniqueOrThrow({
      where: { sku: 'T-10' },
      include: { reviews: true },
    });
    expect(delisted.isListed).toBe(false);
    expect(delisted.reviews).toHaveLength(1);

    const back = await importer.importContent(csv(skus(10)), 'v3');
    expect(back.relisted).toBe(1);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { sku: 'T-10' } }))
        .isListed,
    ).toBe(true);
  });

  it('aborts a suspiciously small export without changing anything', async () => {
    await importer.importContent(csv(skus(10)), 'v1');

    const summary = await importer.importContent(csv(skus(2)), 'truncated');

    expect(summary.status).toBe(ImportRunStatus.ABORTED);
    expect(summary.abortReason).toMatch(/would delist 8 of 10/);
    expect(await prisma.product.count({ where: { isListed: true } })).toBe(10);
    const run = await prisma.importRun.findUniqueOrThrow({
      where: { id: summary.runId },
    });
    expect(run.status).toBe(ImportRunStatus.ABORTED);
  });

  it('keeps the existing data for a SKU whose rows conflict in a later export', async () => {
    await importer.importContent(csv(skus(3)), 'v1');

    const conflicting = csv([
      ...skus(3),
      { sku: 'T-1', status: 'Discontinued' }, // second, different row for T-1
    ]);
    const summary = await importer.importContent(conflicting, 'v2');

    expect(summary.issues).toContainEqual(
      expect.objectContaining({ level: 'error', sku: 'T-1' }),
    );
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: 'T-1' },
    });
    expect(product).toMatchObject({
      status: ProductStatus.ACTIVE,
      isListed: true,
    });
  });

  it('records a failed run and leaves the data untouched for a broken file', async () => {
    await importer.importContent(csv(skus(3)), 'v1');

    await expect(
      importer.importContent('sku,name\nT-1,A', 'broken'),
    ).rejects.toThrow(/missing required column/);

    expect(await prisma.product.count()).toBe(3);
    const run = await prisma.importRun.findFirstOrThrow({
      where: { source: 'broken' },
    });
    expect(run.status).toBe(ImportRunStatus.FAILED);
    expect(run.errorMessage).toMatch(/missing required column/);
  });

  it('serialises concurrent imports (no duplicate-key race)', async () => {
    const [a, b] = await Promise.all([
      importer.importContent(SAMPLE, 'cron'),
      importer.importContent(SAMPLE, 'manual'),
    ]);

    expect([a.inserted, b.inserted].sort()).toEqual([0, 198]);
    expect(await prisma.product.count()).toBe(198);
  });
});
