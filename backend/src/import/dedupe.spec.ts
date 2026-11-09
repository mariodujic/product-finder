import { ProductStatus } from '../generated/prisma/enums';
import { dedupeBySku } from './dedupe';
import { NormalizedProduct } from './import.types';

const product = (
  overrides: Partial<NormalizedProduct> = {},
): NormalizedProduct => ({
  sku: 'P-1',
  name: 'Alpha',
  chemicalName: 'Chem',
  function: 'Polymer',
  applicationArea: 'Coatings',
  region: 'Global',
  certifications: [],
  status: ProductStatus.ACTIVE,
  launchYear: 2007,
  description: 'Desc',
  ...overrides,
});

describe('dedupeBySku', () => {
  it('passes unique SKUs through unchanged', () => {
    const result = dedupeBySku([
      { line: 2, product: product({ sku: 'P-1' }) },
      { line: 3, product: product({ sku: 'P-2' }) },
    ]);
    expect(result.products.map((p) => p.sku)).toEqual(['P-1', 'P-2']);
    expect(result.issues).toEqual([]);
    expect(result.conflictingSkus).toEqual([]);
  });

  it('imports identical duplicates once and warns (P-10013)', () => {
    const result = dedupeBySku([
      { line: 14, product: product() },
      { line: 99, product: product() },
    ]);
    expect(result.products).toHaveLength(1);
    expect(result.conflictingSkus).toEqual([]);
    expect(result.issues).toEqual([
      {
        level: 'warning',
        sku: 'P-1',
        message: 'Duplicate identical rows on lines 14, 99; imported once',
      },
    ]);
  });

  it('skips conflicting duplicates instead of picking one (P-10151: Active vs Discontinued)', () => {
    const result = dedupeBySku([
      { line: 153, product: product({ status: ProductStatus.ACTIVE }) },
      { line: 203, product: product({ status: ProductStatus.DISCONTINUED }) },
    ]);
    expect(result.products).toEqual([]);
    expect(result.conflictingSkus).toEqual(['P-1']);
    expect(result.issues).toEqual([
      {
        level: 'error',
        sku: 'P-1',
        message:
          'Conflicting rows on lines 153, 203; SKU skipped, existing data kept',
      },
    ]);
  });
});
