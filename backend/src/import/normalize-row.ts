import { ProductStatus } from '../generated/prisma/enums';
import { ImportIssue, NormalizedProduct, SourceRow } from './import.types';

export type NormalizeResult =
  | { ok: true; product: NormalizedProduct; issues: ImportIssue[] }
  | { ok: false; sku?: string; issues: ImportIssue[] };

const STATUS_BY_KEY: Record<string, ProductStatus> = {
  active: ProductStatus.ACTIVE,
  phaseout: ProductStatus.PHASE_OUT,
  discontinued: ProductStatus.DISCONTINUED,
};

// Deliberately not "P-\d{5}": other business units will join with their own SKU formats.
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;
const MIN_LAUNCH_YEAR = 1900;

/** Trims and collapses internal runs of whitespace. */
export function clean(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** "Active", "ACTIVE", "active", "Phase out", "phase-out", "PHASE_OUT" all map to the enum. */
export function parseStatus(value: string): ProductStatus | undefined {
  return STATUS_BY_KEY[
    clean(value)
      .toLowerCase()
      .replace(/[\s_-]+/g, '')
  ];
}

/** Pipe-separated list to a sorted, de-duplicated array (stable for hashing). */
export function parseCertifications(value: string): string[] {
  const parts = value.split('|').map(clean).filter(Boolean);
  return [...new Set(parts)].sort((a, b) => a.localeCompare(b));
}

/**
 * Turns one raw CSV row into a clean product, or explains why it can't.
 * A row is rejected only if the product could not be shown or found correctly
 * (no SKU, no name, unknown status, missing filter value). Problems in optional
 * fields (launch year) become warnings and the value is stored as unknown.
 */
export function normalizeRow(
  row: SourceRow,
  currentYear = new Date().getFullYear(),
): NormalizeResult {
  const v = row.values;
  const issues: ImportIssue[] = [];
  const sku = clean(v.sku).toUpperCase();
  const report = (
    level: ImportIssue['level'],
    field: string,
    message: string,
  ) =>
    issues.push({
      level,
      line: row.line,
      sku: sku || undefined,
      field,
      message,
    });

  if (!sku) report('error', 'sku', 'SKU is missing');
  else if (!SKU_PATTERN.test(sku))
    report('error', 'sku', `SKU "${sku}" has an invalid format`);

  const name = clean(v.name);
  if (!name) report('error', 'name', 'Name is missing');

  const status = parseStatus(v.status);
  if (!status) report('error', 'status', `Unknown status "${clean(v.status)}"`);

  const fn = clean(v.function);
  const applicationArea = clean(v.application_area);
  const region = clean(v.region);
  if (!fn) report('error', 'function', 'Function is missing');
  if (!applicationArea)
    report('error', 'application_area', 'Application area is missing');
  if (!region) report('error', 'region', 'Region is missing');

  let launchYear: number | null = null;
  const rawYear = clean(v.launch_year);
  if (rawYear) {
    const year = /^\d{4}$/.test(rawYear) ? Number(rawYear) : NaN;
    if (year >= MIN_LAUNCH_YEAR && year <= currentYear + 1) {
      launchYear = year;
    } else {
      report(
        'warning',
        'launch_year',
        `Launch year "${rawYear}" is not a valid year; stored as unknown`,
      );
    }
  }

  if (!status || issues.some((i) => i.level === 'error')) {
    return { ok: false, sku: sku || undefined, issues };
  }

  return {
    ok: true,
    issues,
    product: {
      sku,
      name,
      chemicalName: clean(v.chemical_name),
      function: fn,
      applicationArea,
      region,
      certifications: parseCertifications(v.certifications),
      status,
      launchYear,
      description: clean(v.description),
    },
  };
}
