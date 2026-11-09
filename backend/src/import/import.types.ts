import { ProductStatus } from '../generated/prisma/enums';

/** Columns the PIM export must contain. Extra columns are ignored. */
export const REQUIRED_COLUMNS = [
  'sku',
  'name',
  'chemical_name',
  'function',
  'application_area',
  'region',
  'certifications',
  'status',
  'launch_year',
  'description',
] as const;

export type CsvColumn = (typeof REQUIRED_COLUMNS)[number];
export type RawRow = Record<CsvColumn, string>;

/** A raw CSV record plus the 1-based line it came from, for error reporting. */
export interface SourceRow {
  line: number;
  values: RawRow;
}

/** Clean, validated product data as it will be stored. */
export interface NormalizedProduct {
  sku: string;
  name: string;
  chemicalName: string;
  function: string;
  applicationArea: string;
  region: string;
  certifications: string[];
  status: ProductStatus;
  launchYear: number | null;
  description: string;
}

export interface ImportIssue {
  level: 'warning' | 'error';
  line?: number;
  sku?: string;
  field?: string;
  message: string;
}

export interface ImportOptions {
  /** Skip the mass-delisting safety guard. */
  force?: boolean;
  /** Max share of currently listed products a single import may delist (0..1). */
  maxDelistRatio?: number;
}

export const DEFAULT_MAX_DELIST_RATIO = 0.2;
