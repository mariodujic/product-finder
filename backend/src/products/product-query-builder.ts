import { Prisma } from '../generated/prisma/client';
import { ProductStatus } from '../generated/prisma/enums';
import { ProductQueryDto, SortOption } from './dto/product-query.dto';

export const GLOBAL_REGION = 'Global';
const MAX_SEARCH_TERMS = 5;

/** Filters that have their own facet (count list) in the UI. */
export type ScalarFacet = 'function' | 'applicationArea' | 'region';

type Filters = Pick<
  ProductQueryDto,
  | 'q'
  | 'function'
  | 'applicationArea'
  | 'region'
  | 'certifications'
  | 'includeDiscontinued'
>;

/** Splits free text into terms. Every term must match somewhere (AND), so "sulfate home" narrows. */
export function searchTerms(q: string | undefined): string[] {
  return (q ?? '').split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS);
}

/** A region filter also matches products sold globally. */
export function expandRegions(regions: string[]): string[] {
  return regions.includes(GLOBAL_REGION)
    ? regions
    : [...regions, GLOBAL_REGION];
}

/**
 * Translates the search state into a Prisma filter.
 * - Only listed products (present in the latest PIM export) are searchable.
 * - Discontinued products are hidden unless requested.
 * - OR within a filter group, AND across groups. Certifications are AND
 *   (a buyer needing "Vegan" and "Halal" needs both).
 *
 * @param omit leave out one group's own filter. Used for that group's facet counts,
 *   so the counts show what you would get by changing that selection.
 */
export function buildProductWhere(
  filters: Filters,
  omit?: ScalarFacet,
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ isListed: true }];

  if (!filters.includeDiscontinued) {
    and.push({ status: { not: ProductStatus.DISCONTINUED } });
  }

  for (const term of searchTerms(filters.q)) {
    const contains = { contains: term, mode: 'insensitive' as const };
    and.push({
      OR: [
        { name: contains },
        { chemicalName: contains },
        { sku: contains },
        { description: contains },
      ],
    });
  }

  if (omit !== 'function' && filters.function?.length) {
    and.push({ function: { in: filters.function } });
  }
  if (omit !== 'applicationArea' && filters.applicationArea?.length) {
    and.push({ applicationArea: { in: filters.applicationArea } });
  }
  if (omit !== 'region' && filters.region?.length) {
    and.push({ region: { in: expandRegions(filters.region) } });
  }
  if (filters.certifications?.length) {
    and.push({ certifications: { hasEvery: filters.certifications } });
  }

  return { AND: and };
}

/** Every sort ends with a unique key so pagination is stable. */
export function buildOrderBy(
  sort: SortOption,
): Prisma.ProductOrderByWithRelationInput[] {
  const tieBreak: Prisma.ProductOrderByWithRelationInput[] = [
    { name: 'asc' },
    { sku: 'asc' },
  ];
  switch (sort) {
    case 'name':
      return tieBreak;
    case '-name':
      return [{ name: 'desc' }, { sku: 'desc' }];
    case 'launchYear':
      return [{ launchYear: { sort: 'asc', nulls: 'last' } }, ...tieBreak];
    case '-launchYear':
      return [{ launchYear: { sort: 'desc', nulls: 'last' } }, ...tieBreak];
    case '-rating':
      return [
        { ratingAvg: { sort: 'desc', nulls: 'last' } },
        { reviewCount: 'desc' },
        ...tieBreak,
      ];
  }
}
