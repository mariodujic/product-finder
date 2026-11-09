import { readCsv } from './csv-reader';
import { dedupeBySku, LocatedProduct } from './dedupe';
import { ImportIssue, NormalizedProduct } from './import.types';
import { normalizeRow } from './normalize-row';

export interface ExportAnalysis {
  rowsRead: number;
  /** Valid, de-duplicated products ready to be written. */
  products: NormalizedProduct[];
  /** Every SKU in the file, including rejected and conflicting rows. Used to decide what to delist. */
  seenSkus: Set<string>;
  /** Rows (not SKUs) that were not imported, plus the rows of conflicting SKUs. */
  skipped: number;
  issues: ImportIssue[];
}

/** CSV text in, clean products plus a data-quality report out. No database access. */
export function analyzeExport(content: string): ExportAnalysis {
  const rows = readCsv(content);
  const issues: ImportIssue[] = [];
  const valid: LocatedProduct[] = [];
  const seenSkus = new Set<string>();
  let skipped = 0;

  for (const row of rows) {
    const result = normalizeRow(row);
    issues.push(...result.issues);
    if (result.ok) {
      valid.push({ line: row.line, product: result.product });
      seenSkus.add(result.product.sku);
    } else {
      skipped++;
      if (result.sku) seenSkus.add(result.sku);
    }
  }

  const deduped = dedupeBySku(valid);
  issues.push(...deduped.issues);
  const conflicting = new Set(deduped.conflictingSkus);
  skipped += valid.filter((v) => conflicting.has(v.product.sku)).length;

  return {
    rowsRead: rows.length,
    products: deduped.products,
    seenSkus,
    skipped,
    issues,
  };
}
