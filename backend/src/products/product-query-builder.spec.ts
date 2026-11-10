import { ProductStatus } from '../generated/prisma/enums';
import {
  buildOrderBy,
  buildProductWhere,
  expandRegions,
  searchTerms,
} from './product-query-builder';

describe('searchTerms', () => {
  it('splits on whitespace and drops empties', () => {
    expect(searchTerms('  sodium   laureth ')).toEqual(['sodium', 'laureth']);
  });

  it('caps the number of terms', () => {
    expect(searchTerms('a b c d e f g')).toHaveLength(5);
  });

  it('handles a missing query', () => {
    expect(searchTerms(undefined)).toEqual([]);
  });
});

describe('expandRegions', () => {
  it('adds Global to a specific region', () => {
    expect(expandRegions(['EMEA'])).toEqual(['EMEA', 'Global']);
  });

  it('does not duplicate Global', () => {
    expect(expandRegions(['Global'])).toEqual(['Global']);
  });
});

describe('buildProductWhere', () => {
  const base = { includeDiscontinued: false };

  it('by default returns only listed, non-discontinued products', () => {
    expect(buildProductWhere(base)).toEqual({
      AND: [
        { isListed: true },
        { status: { not: ProductStatus.DISCONTINUED } },
      ],
    });
  });

  it('includes discontinued products on request, but never delisted ones', () => {
    expect(buildProductWhere({ includeDiscontinued: true })).toEqual({
      AND: [{ isListed: true }],
    });
  });

  it('requires every search term to match one of the text fields', () => {
    const where = buildProductWhere({ ...base, q: 'sulfate home' });
    const terms = (where.AND as object[]).slice(2);
    expect(terms).toHaveLength(2);
    expect(terms[0]).toEqual({
      OR: [
        { name: { contains: 'sulfate', mode: 'insensitive' } },
        { chemicalName: { contains: 'sulfate', mode: 'insensitive' } },
        { sku: { contains: 'sulfate', mode: 'insensitive' } },
        { description: { contains: 'sulfate', mode: 'insensitive' } },
      ],
    });
  });

  it('ORs values within a group and ANDs across groups', () => {
    const where = buildProductWhere({
      ...base,
      function: ['Surfactant', 'Emulsifier'],
      applicationArea: ['Home Care'],
      region: ['EMEA'],
      certifications: ['Vegan', 'Halal'],
    });
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { function: { in: ['Surfactant', 'Emulsifier'] } },
        { applicationArea: { in: ['Home Care'] } },
        { region: { in: ['EMEA', 'Global'] } },
        { certifications: { hasEvery: ['Vegan', 'Halal'] } },
      ]),
    );
  });

  it('leaves out the omitted group so its facet counts stay useful', () => {
    const where = buildProductWhere(
      { ...base, function: ['Surfactant'], region: ['EMEA'] },
      'function',
    );
    expect(JSON.stringify(where)).not.toContain('Surfactant');
    expect(JSON.stringify(where)).toContain('EMEA');
  });

  it('ignores empty filter arrays', () => {
    expect(buildProductWhere({ ...base, function: [], region: [] })).toEqual(
      buildProductWhere(base),
    );
  });
});

describe('buildOrderBy', () => {
  it.each(['name', '-name', 'launchYear', '-launchYear', '-rating'] as const)(
    '%s ends with a unique key for stable paging',
    (sort) => {
      const order = buildOrderBy(sort);
      expect(Object.keys(order[order.length - 1])).toEqual(['sku']);
    },
  );

  it('puts products without a launch year last in both directions', () => {
    expect(buildOrderBy('launchYear')[0]).toEqual({
      launchYear: { sort: 'asc', nulls: 'last' },
    });
    expect(buildOrderBy('-launchYear')[0]).toEqual({
      launchYear: { sort: 'desc', nulls: 'last' },
    });
  });

  it('sorts unrated products last when sorting by rating', () => {
    expect(buildOrderBy('-rating')[0]).toEqual({
      ratingAvg: { sort: 'desc', nulls: 'last' },
    });
  });
});
