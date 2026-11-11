/** Mirrors the backend API contract (backend/src/products, backend/src/reviews). */

export type ProductStatus = 'ACTIVE' | 'PHASE_OUT' | 'DISCONTINUED';

export interface RatingSummary {
  /** Average 1..5, null when there are no reviews. */
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
  /** False when the product is no longer in the PIM export. */
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

export interface Review {
  id: number;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
}

export interface ReviewPage {
  items: Review[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NewReview {
  authorName: string;
  rating: number;
  title?: string;
  body: string;
  /** Honeypot: always empty when sent by a person. */
  website?: string;
}
