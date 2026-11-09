import { contentHash } from './content-hash';
import {
  DEFAULT_MAX_DELIST_RATIO,
  ImportOptions,
  NormalizedProduct,
} from './import.types';

export interface ExistingProduct {
  sku: string;
  contentHash: string;
  isListed: boolean;
}

export interface HashedProduct extends NormalizedProduct {
  contentHash: string;
}

export interface ImportPlan {
  toInsert: HashedProduct[];
  /** Content changed. Also relists the product if it was delisted. */
  toUpdate: HashedProduct[];
  /** Content unchanged, but back in the export after being delisted. */
  toRelist: string[];
  toDelist: string[];
  unchanged: number;
  /** Set when a safety check failed. The plan must not be applied. */
  abortReason?: string;
}

/**
 * Pure diff between the export and the database. No I/O, so every rule,
 * including the safety guard, is unit-testable.
 *
 * @param seenSkus every SKU present in the file, including rows that were
 *   rejected or conflicting. Those must not be delisted: a bad row in tonight's
 *   export is a data problem, not a sign the product was withdrawn.
 */
export function buildImportPlan(
  incoming: NormalizedProduct[],
  seenSkus: ReadonlySet<string>,
  existing: ExistingProduct[],
  options: ImportOptions = {},
): ImportPlan {
  const plan: ImportPlan = {
    toInsert: [],
    toUpdate: [],
    toRelist: [],
    toDelist: [],
    unchanged: 0,
  };

  if (incoming.length === 0) {
    return { ...plan, abortReason: 'The export contains no valid products' };
  }

  const existingBySku = new Map(existing.map((e) => [e.sku, e]));
  for (const product of incoming) {
    const hashed: HashedProduct = {
      ...product,
      contentHash: contentHash(product),
    };
    const current = existingBySku.get(product.sku);
    if (!current) plan.toInsert.push(hashed);
    else if (current.contentHash !== hashed.contentHash)
      plan.toUpdate.push(hashed);
    else if (!current.isListed) plan.toRelist.push(product.sku);
    else plan.unchanged++;
  }

  plan.toDelist = existing
    .filter((e) => e.isListed && !seenSkus.has(e.sku))
    .map((e) => e.sku);

  const listedCount = existing.filter((e) => e.isListed).length;
  const maxRatio = options.maxDelistRatio ?? DEFAULT_MAX_DELIST_RATIO;
  if (
    !options.force &&
    listedCount > 0 &&
    plan.toDelist.length / listedCount > maxRatio
  ) {
    plan.abortReason =
      `The export would delist ${plan.toDelist.length} of ${listedCount} listed products ` +
      `(more than ${Math.round(maxRatio * 100)}%). This usually means a truncated export. ` +
      `Re-run with --force if it is intentional.`;
  }
  return plan;
}
