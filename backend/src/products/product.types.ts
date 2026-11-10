import { ProductStatus } from '../generated/prisma/enums';

export interface RatingSummary {
  /** Average 1..5 rounded to 2 decimals; null when there are no reviews. */
  average: number | null;
  count: number;
}

export interface ProductSummary {
  sku: string;
  name: string;
  chemicalName: string;
  function: string;
  applicationArea: string;
  region: string;
  certifications: string[];
  status: ProductStatus;
  launchYear: number | null;
  rating: RatingSummary;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  /** False when the product is no longer in the PIM export. The page stays reachable for old links. */
  isListed: boolean;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface ProductFacets {
  function: FacetValue[];
  applicationArea: FacetValue[];
  region: FacetValue[];
  certifications: FacetValue[];
}

export interface ProductSearchResult {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
  facets: ProductFacets;
}
