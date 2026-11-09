import { ProductStatus } from '../generated/prisma/enums';
import { RawRow } from './import.types';
import {
  normalizeRow,
  parseCertifications,
  parseStatus,
} from './normalize-row';

const validRow: RawRow = {
  sku: 'P-10001',
  name: 'Quorin SF 470',
  chemical_name: 'Sodium Laureth Sulfate',
  function: 'Surfactant',
  application_area: 'Home Care',
  region: 'EMEA',
  certifications: 'Kosher|RSPO Mass Balance',
  status: 'Active',
  launch_year: '2012',
  description: 'Surfactant for home care.',
};

const normalize = (overrides: Partial<RawRow>) =>
  normalizeRow({ line: 7, values: { ...validRow, ...overrides } }, 2026);

describe('parseStatus', () => {
  it.each([
    ['Active', ProductStatus.ACTIVE],
    ['active', ProductStatus.ACTIVE], // P-10008
    ['ACTIVE', ProductStatus.ACTIVE], // P-10024
    ['Phase-out', ProductStatus.PHASE_OUT],
    ['Phase out', ProductStatus.PHASE_OUT], // P-10042
    ['PHASE_OUT', ProductStatus.PHASE_OUT],
    [' Discontinued ', ProductStatus.DISCONTINUED],
  ])('maps %p to %s', (raw, expected) => {
    expect(parseStatus(raw)).toBe(expected);
  });

  it.each(['', 'Obsolete', 'Inactive'])('returns undefined for %p', (raw) => {
    expect(parseStatus(raw)).toBeUndefined();
  });
});

describe('parseCertifications', () => {
  it('splits on pipes, trims, drops empties and duplicates, and sorts', () => {
    expect(parseCertifications(' Vegan | Halal||Vegan ')).toEqual([
      'Halal',
      'Vegan',
    ]);
  });

  it('returns an empty list for an empty field', () => {
    expect(parseCertifications('')).toEqual([]);
  });
});

describe('normalizeRow', () => {
  it('maps a clean row to a product', () => {
    const result = normalize({});
    expect(result).toEqual({
      ok: true,
      issues: [],
      product: {
        sku: 'P-10001',
        name: 'Quorin SF 470',
        chemicalName: 'Sodium Laureth Sulfate',
        function: 'Surfactant',
        applicationArea: 'Home Care',
        region: 'EMEA',
        certifications: ['Kosher', 'RSPO Mass Balance'],
        status: ProductStatus.ACTIVE,
        launchYear: 2012,
        description: 'Surfactant for home care.',
      },
    });
  });

  it('trims padded values (region " EMEA " on P-10016, name on P-10059)', () => {
    const result = normalize({ region: ' EMEA ', name: '  Puraxin SF 120 ' });
    expect(result.ok && result.product.region).toBe('EMEA');
    expect(result.ok && result.product.name).toBe('Puraxin SF 120');
  });

  it('upper-cases the SKU so URLs and lookups are case-insensitive', () => {
    const result = normalize({ sku: ' p-10001 ' });
    expect(result.ok && result.product.sku).toBe('P-10001');
  });

  it('rejects a row without a name and still reports its SKU (P-10119)', () => {
    const result = normalize({ name: '' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      sku: 'P-10001',
      issues: [
        { level: 'error', line: 7, field: 'name', message: 'Name is missing' },
      ],
    });
  });

  it('rejects an unknown status rather than guessing', () => {
    const result = normalize({ status: 'Obsolete' });
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toBe('Unknown status "Obsolete"');
  });

  it.each([
    ['sku', { sku: '' }],
    ['sku', { sku: 'P 10001' }],
    ['function', { function: ' ' }],
    ['application_area', { application_area: '' }],
    ['region', { region: '' }],
  ])('rejects a row with a missing or invalid %s', (field, overrides) => {
    const result = normalize(overrides);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.field)).toContain(field);
  });

  it('stores an empty launch year as unknown without a warning (P-10091)', () => {
    const result = normalize({ launch_year: '' });
    expect(result).toMatchObject({
      ok: true,
      issues: [],
      product: { launchYear: null },
    });
  });

  it.each(['n/a', '20x1', '1850', '2030'])(
    'keeps the product but warns for launch year %p (P-10105)',
    (year) => {
      const result = normalize({ launch_year: year });
      expect(result.ok).toBe(true);
      expect(result.ok && result.product.launchYear).toBeNull();
      expect(result.issues).toEqual([
        expect.objectContaining({ level: 'warning', field: 'launch_year' }),
      ]);
    },
  );

  it('accepts next year (products announced ahead of launch)', () => {
    const result = normalize({ launch_year: '2027' });
    expect(result.ok && result.product.launchYear).toBe(2027);
  });
});
