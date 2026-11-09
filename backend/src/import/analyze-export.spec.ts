import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProductStatus } from '../generated/prisma/enums';
import { analyzeExport } from './analyze-export';

/** Golden test against the real, unmodified PIM sample export. */
describe('analyzeExport on data/products.csv', () => {
  const csv = readFileSync(
    join(__dirname, '../../../data/products.csv'),
    'utf8',
  );
  const analysis = analyzeExport(csv);
  const bySku = new Map(analysis.products.map((p) => [p.sku, p]));

  it('reads every row', () => {
    expect(analysis.rowsRead).toBe(202);
  });

  it('imports 198 products: 200 unique SKUs minus one invalid and one conflicting', () => {
    expect(analysis.products).toHaveLength(198);
    expect(analysis.skipped).toBe(3); // P-10119 (1 row) + P-10151 (2 rows)
  });

  it('still counts the skipped SKUs as seen, so they are never delisted', () => {
    expect(analysis.seenSkus.size).toBe(200);
    expect(analysis.seenSkus.has('P-10119')).toBe(true);
    expect(analysis.seenSkus.has('P-10151')).toBe(true);
  });

  it('reports exactly the known data-quality problems', () => {
    const summary = analysis.issues
      .map((i) => `${i.level} ${i.sku} ${i.field ?? '-'}`)
      .sort();
    expect(summary).toEqual([
      'error P-10119 name',
      'error P-10151 -',
      'warning P-10013 -',
      'warning P-10105 launch_year',
    ]);
  });

  it('normalises the dirty values', () => {
    expect(bySku.get('P-10008')?.status).toBe(ProductStatus.ACTIVE);
    expect(bySku.get('P-10024')?.status).toBe(ProductStatus.ACTIVE);
    expect(bySku.get('P-10042')?.status).toBe(ProductStatus.PHASE_OUT);
    expect(bySku.get('P-10016')?.region).toBe('EMEA');
    expect(bySku.get('P-10059')?.name).toBe('Puraxin SF 120');
    expect(bySku.get('P-10091')?.launchYear).toBeNull();
    expect(bySku.get('P-10132')?.description).toContain(
      '"high-solids" systems',
    );
  });

  it('ends up with clean facet values', () => {
    const regions = new Set(analysis.products.map((p) => p.region));
    expect([...regions].sort()).toEqual([
      'Asia Pacific',
      'EMEA',
      'Global',
      'Latin America',
      'North America',
    ]);
  });
});
