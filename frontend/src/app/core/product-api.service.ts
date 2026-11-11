import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SearchState, toQueryParams } from '../features/search/search-state';
import {
  NewReview,
  ProductDetail,
  ProductSearchResult,
  Review,
  ReviewPage,
} from './api.models';

/** Thin typed client for the Product Finder API. All paths are same-origin (/api). */
@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private readonly http = inject(HttpClient);

  search(state: SearchState): Observable<ProductSearchResult> {
    // Same params as the URL: what you share is exactly what the API receives.
    const params = new HttpParams({ fromObject: toQueryParams(state) });
    return this.http.get<ProductSearchResult>('/api/products', { params });
  }

  product(sku: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`/api/products/${encodeURIComponent(sku)}`);
  }

  reviews(sku: string, page: number, pageSize = 10): Observable<ReviewPage> {
    const params = new HttpParams({ fromObject: { page, pageSize } });
    return this.http.get<ReviewPage>(`/api/products/${encodeURIComponent(sku)}/reviews`, {
      params,
    });
  }

  createReview(sku: string, review: NewReview): Observable<Review> {
    return this.http.post<Review>(`/api/products/${encodeURIComponent(sku)}/reviews`, review);
  }
}
