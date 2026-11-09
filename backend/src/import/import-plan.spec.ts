import { ProductStatus } from '../generated/prisma/enums';
import { contentHash } from './content-hash';
import { buildImportPlan, ExistingProduct } from './import-plan';
import { NormalizedProduct } from './import.types';

const product = (
  sku: string,
  overrides: Partial<NormalizedProduct> = {},
): NormalizedProduct => ({
  sku,
  name: `Product ${sku}`,
  chemicalName: 'Chem',
  function: 'Polymer',
  applicationArea: 'Coatings',
  region: 'Global',
  certifications: [],
  status: ProductStatus.ACTIVE,
  launchYear: 2020,
  description: '',
  ...overrides,
});

const stored = (p: NormalizedProduct, isListed = true): ExistingProduct => ({
  sku: p.sku,
  contentHash: contentHash(p),
  isListed,
});

const skus = (...items: { sku: string }[]) => new Set(items.map((i) => i.sku));
const range = (n: number) =>
  Array.from({ length: n }, (_, i) => product(`P-${i + 1}`));

describe('buildImportPlan', () => {
  it('inserts everything into an empty database', () => {
    const incoming = range(3);
    const plan = buildImportPlan(incoming, skus(...incoming), []);
    expect(plan.toInsert.map((p) => p.sku)).toEqual(['P-1', 'P-2', 'P-3']);
    expect(plan).toMatchObject({
      toUpdate: [],
      toDelist: [],
      toRelist: [],
      unchanged: 0,
    });
    expect(plan.abortReason).toBeUndefined();
  });

  it('changes nothing when the same export is imported again (idempotent)', () => {
    const incoming = range(3);
    const plan = buildImportPlan(
      incoming,
      skus(...incoming),
      incoming.map((p) => stored(p)),
    );
    expect(plan).toEqual({
      toInsert: [],
      toUpdate: [],
      toRelist: [],
      toDelist: [],
      unchanged: 3,
    });
  });

  it('updates only products whose content changed', () => {
    const before = range(2);
    const after = [
      before[0],
      { ...before[1], status: ProductStatus.DISCONTINUED },
    ];
    const plan = buildImportPlan(
      after,
      skus(...after),
      before.map((p) => stored(p)),
    );
    expect(plan.toUpdate.map((p) => p.sku)).toEqual(['P-2']);
    expect(plan.unchanged).toBe(1);
  });

  it('delists products missing from the export (never deletes)', () => {
    const before = range(10);
    const after = before.slice(0, 9);
    const plan = buildImportPlan(
      after,
      skus(...after),
      before.map((p) => stored(p)),
    );
    expect(plan.toDelist).toEqual(['P-10']);
    expect(plan.abortReason).toBeUndefined();
  });

  it('does not delist a product whose row was present but rejected', () => {
    const before = range(10);
    const valid = before.slice(0, 9);
    const seen = skus(...before); // P-10 is in the file, just invalid tonight
    const plan = buildImportPlan(
      valid,
      seen,
      before.map((p) => stored(p)),
    );
    expect(plan.toDelist).toEqual([]);
  });

  it('relists a product that comes back unchanged', () => {
    const p = product('P-1');
    const plan = buildImportPlan([p], skus(p), [stored(p, false)]);
    expect(plan.toRelist).toEqual(['P-1']);
  });

  it('updates (and thereby relists) a product that comes back changed', () => {
    const p = product('P-1');
    const changed = { ...p, name: 'Renamed' };
    const plan = buildImportPlan([changed], skus(p), [stored(p, false)]);
    expect(plan.toUpdate.map((x) => x.sku)).toEqual(['P-1']);
    expect(plan.toRelist).toEqual([]);
  });

  it('ignores already delisted products when counting delistings', () => {
    const listed = range(5);
    const old = product('P-OLD');
    const plan = buildImportPlan(listed, skus(...listed), [
      ...listed.map((p) => stored(p)),
      stored(old, false),
    ]);
    expect(plan.toDelist).toEqual([]);
  });

  describe('safety guard against truncated exports', () => {
    const before = range(10);
    const existing = before.map((p) => stored(p));

    it('allows delisting up to 20% of the listed catalogue', () => {
      const after = before.slice(0, 8);
      expect(
        buildImportPlan(after, skus(...after), existing).abortReason,
      ).toBeUndefined();
    });

    it('aborts when more than 20% would be delisted', () => {
      const after = before.slice(0, 7);
      const plan = buildImportPlan(after, skus(...after), existing);
      expect(plan.abortReason).toMatch(/would delist 3 of 10 listed products/);
    });

    it('can be overridden with force', () => {
      const after = before.slice(0, 1);
      const plan = buildImportPlan(after, skus(...after), existing, {
        force: true,
      });
      expect(plan.abortReason).toBeUndefined();
      expect(plan.toDelist).toHaveLength(9);
    });

    it('respects a custom threshold', () => {
      const after = before.slice(0, 9);
      const plan = buildImportPlan(after, skus(...after), existing, {
        maxDelistRatio: 0.05,
      });
      expect(plan.abortReason).toBeDefined();
    });

    it('aborts when the export has no valid products at all', () => {
      const plan = buildImportPlan([], new Set(), existing, { force: true });
      expect(plan.abortReason).toBe('The export contains no valid products');
    });
  });
});
