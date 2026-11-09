import { createHash } from 'node:crypto';
import { NormalizedProduct } from './import.types';

/** Stable fingerprint of the imported fields, used to skip unchanged products. */
export function contentHash(p: NormalizedProduct): string {
  const canonical = [
    p.sku,
    p.name,
    p.chemicalName,
    p.function,
    p.applicationArea,
    p.region,
    p.certifications,
    p.status,
    p.launchYear,
    p.description,
  ];
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
