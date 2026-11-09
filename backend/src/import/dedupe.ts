import { isDeepStrictEqual } from 'node:util';
import { ImportIssue, NormalizedProduct } from './import.types';

export interface LocatedProduct {
  line: number;
  product: NormalizedProduct;
}

export interface DedupeResult {
  products: NormalizedProduct[];
  /** SKUs whose rows disagree. Skipped this run; existing data stays untouched. */
  conflictingSkus: string[];
  issues: ImportIssue[];
}

/**
 * Resolves SKUs that appear more than once in an export.
 * - Identical rows: a harmless export glitch. Keep one and warn.
 * - Rows that disagree (e.g. Active vs Discontinued): don't guess. Publishing
 *   the wrong status is exactly the "customers ask about products we no longer
 *   sell" problem. The SKU is skipped and reported for the PIM owner to fix.
 */
export function dedupeBySku(rows: LocatedProduct[]): DedupeResult {
  const bySku = new Map<string, LocatedProduct[]>();
  for (const row of rows) {
    const group = bySku.get(row.product.sku) ?? [];
    group.push(row);
    bySku.set(row.product.sku, group);
  }

  const result: DedupeResult = {
    products: [],
    conflictingSkus: [],
    issues: [],
  };

  for (const [sku, group] of bySku) {
    if (group.length === 1) {
      result.products.push(group[0].product);
      continue;
    }
    const lines = group.map((g) => g.line).join(', ');
    const identical = group.every((g) =>
      isDeepStrictEqual(g.product, group[0].product),
    );
    if (identical) {
      result.products.push(group[0].product);
      result.issues.push({
        level: 'warning',
        sku,
        message: `Duplicate identical rows on lines ${lines}; imported once`,
      });
    } else {
      result.conflictingSkus.push(sku);
      result.issues.push({
        level: 'error',
        sku,
        message: `Conflicting rows on lines ${lines}; SKU skipped, existing data kept`,
      });
    }
  }
  return result;
}
